"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { DependencyNodeShape } from "@prisma/client";
import {
  createDependencyEdge,
  createDependencyNode,
  deleteDependencyEdge,
  deleteDependencyNode,
  moveDependencyNode,
  updateDependencyNode,
} from "@/app/modules/[id]/dependency-graph-actions";

export type DependencyGraphNode = {
  id: string;
  assetId: string | null;
  label: string;
  category: string | null;
  shape: DependencyNodeShape;
  x: number;
  y: number;
};
export type DependencyGraphEdge = { id: string; fromNodeId: string; toNodeId: string };
export type DependencyGraphData = { nodes: DependencyGraphNode[]; edges: DependencyGraphEdge[] };

// The "home" view — what you see at zoom 1, pan (0,0). Nodes can live well outside
// this box once you pan/zoom; it's just the starting viewport, not a hard boundary.
const CANVAS_W = 900;
const CANVAS_H = 500;
const NODE_SIZE = 64;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
// Sanity cap only — not a visual boundary — so a stray drag can't send a node to Infinity.
const WORLD_BOUND = 4000;

/**
 * Colors by category, open-ended text the module's builders type themselves (not
 * the fixed feedback categories). A freeform canvas is an "any two marks can end
 * up adjacent" layout, and the dataviz skill's validator confirms (see
 * feedback-bubble-chart.tsx) that even 4 colors from the documented palette can't
 * clear colorblind-safety there in both light and dark. So only the first three
 * distinct categories (by first appearance) get a validated hue — the palette's
 * first three slots are the ones proven safe all-pairs. Everything past that
 * falls back to a neutral gray and leans on `shape` + the always-visible label
 * for identity instead, per Jay's own ask for shape as a second visual axis.
 */
const CATEGORY_SLOTS = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
];

function categoryColorVar(category: string | null, order: string[]): string {
  if (!category) return "var(--dg-neutral)";
  const idx = order.indexOf(category);
  if (idx < 0 || idx >= CATEGORY_SLOTS.length) return "var(--dg-neutral)";
  return `var(--dg-slot-${idx})`;
}

function NodeShape({
  shape,
  size,
  fill,
  stroke,
}: {
  shape: DependencyNodeShape;
  size: number;
  fill: string;
  stroke?: string;
}) {
  const half = size / 2;
  const common = stroke ? { fill: "none", stroke, strokeWidth: 2 } : { fill };
  if (shape === "circle") return <circle r={half} {...common} />;
  if (shape === "square") return <rect x={-half} y={-half} width={size} height={size} rx={6} {...common} />;
  if (shape === "diamond") return <polygon points={`0,${-half} ${half},0 0,${half} ${-half},0`} {...common} />;
  // hexagon
  const pts = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (Math.PI / 180) * deg;
    return `${(half * Math.sin(rad)).toFixed(1)},${(-half * Math.cos(rad)).toFixed(1)}`;
  });
  return <polygon points={pts.join(" ")} {...common} />;
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const iconBtn = `${secondaryBtn} flex h-8 w-8 items-center justify-center p-0 text-base leading-none`;

export function DependencyGraph({
  moduleId,
  assets,
  graph,
}: {
  moduleId: string;
  assets: { id: string; name: string }[];
  graph: DependencyGraphData;
}) {
  const [prevGraph, setPrevGraph] = useState(graph);
  const [nodes, setNodes] = useState(graph.nodes);
  const [edges, setEdges] = useState(graph.edges);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", category: "", shape: "circle" as DependencyNodeShape, assetId: "" });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [, startTransition] = useTransition();
  // Re-sync from fresh server data (e.g. after revalidation) without an effect —
  // adjusting state during render, per https://react.dev/learn/you-might-not-need-an-effect.
  if (graph !== prevGraph) {
    setPrevGraph(graph);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    // A node just added optimistically carries a temp id until this resync swaps
    // in the server's real one — if that lands while it's selected, `selected`
    // is left pointing at an id `nodes` no longer has, silently hiding its
    // Edit/Delete/Link buttons. Clearing selection here is a harmless UI reset
    // (worst case: click the node again) instead of a confusing dead state.
    setSelected(null);
    setLinkFrom(null);
  }
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const panning = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors of the latest zoom/pan for the wheel listener below, which is attached
  // once (empty deps) and needs current values without re-subscribing on every change.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  const categoryOrder = [...new Set(nodes.map((n) => n.category).filter((c): c is string => Boolean(c)))];

  /** Screen (client) point → the node's own logical coordinate space (undoes pan+zoom). */
  function toLocalPoint(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const outerX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const outerY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    const x = (outerX - pan.x) / zoom;
    const y = (outerY - pan.y) / zoom;
    return { x: Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, x)), y: Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, y)) };
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ax = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const ay = ((clientY - rect.top) / rect.height) * CANVAS_H;
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z0 * factor));
    const ratio = z1 / z0;
    setPan({ x: ax - ratio * (ax - p0.x), y: ay - ratio * (ay - p0.y) });
    setZoom(z1);
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // React's onWheel is attached passively at the root, so preventDefault() inside
  // it is silently ignored (the page would scroll instead of just the canvas
  // zooming) — a native listener is the only way to actually stop that.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  function persistMove(nodeId: string, x: number, y: number) {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => {
      startTransition(() => {
        void moveDependencyNode(moduleId, nodeId, x, y);
      });
    }, 300);
  }

  function onNodePointerDown(e: React.PointerEvent, nodeId: string) {
    e.stopPropagation();
    if (linkFrom) {
      if (linkFrom !== nodeId) {
        startTransition(async () => {
          const res = await createDependencyEdge(moduleId, linkFrom, nodeId);
          if (!res.errors?.length) {
            setEdges((prev) => [...prev, { id: `temp-${Date.now()}`, fromNodeId: linkFrom, toNodeId: nodeId }]);
          }
        });
      }
      setLinkFrom(null);
      return;
    }
    setSelected(nodeId);
    dragId.current = nodeId;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    // A node's own pointerdown already stopped propagation, so reaching here
    // (target === the svg itself) means empty canvas — start panning.
    if (e.target !== e.currentTarget) return;
    panning.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (dragId.current) {
      const { x, y } = toLocalPoint(e);
      const id = dragId.current;
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
      persistMove(id, x, y);
      return;
    }
    if (panning.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxSvg = (e.clientX - panning.current.startX) * (CANVAS_W / rect.width);
      const dySvg = (e.clientY - panning.current.startY) * (CANVAS_H / rect.height);
      setPan({ x: panning.current.startPanX + dxSvg, y: panning.current.startPanY + dySvg });
    }
  }

  function onCanvasPointerUp() {
    dragId.current = null;
    panning.current = null;
  }

  const selectedNode = nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="space-y-3">
      <style>{`
        .dg-canvas { --dg-slot-0: #2a78d6; --dg-slot-1: #eb6834; --dg-slot-2: #1baf7a; --dg-neutral: #898781; }
        @media (prefers-color-scheme: dark) {
          .dg-canvas { --dg-slot-0: #3987e5; --dg-slot-1: #d95926; --dg-slot-2: #199e70; --dg-neutral: #898781; }
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={secondaryBtn}
          onClick={() => {
            setEditingId(null);
            setAdding((v) => {
              if (!v) setForm({ label: "", category: "", shape: "circle", assetId: "" });
              return !v;
            });
          }}
        >
          {adding ? "Cancel" : "+ Add node"}
        </button>
        <button
          type="button"
          className={linkFrom ? primaryBtn : secondaryBtn}
          onClick={() => setLinkFrom((v) => (v ? null : selected))}
          disabled={!selected && !linkFrom}
          title="Click a node, then click another to say the first must happen before the second"
        >
          {linkFrom ? "Click the node it leads to…" : "Link from selected"}
        </button>
        {selectedNode && !linkFrom && (
          <>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                setAdding(false);
                setForm({
                  label: selectedNode.label,
                  category: selectedNode.category ?? "",
                  shape: selectedNode.shape,
                  assetId: selectedNode.assetId ?? "",
                });
                setEditingId(selectedNode.id);
              }}
            >
              Edit &quot;{selectedNode.label}&quot;
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                startTransition(() => void deleteDependencyNode(moduleId, selectedNode.id));
                setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
                setSelected(null);
                setEditingId(null);
              }}
            >
              Delete &quot;{selectedNode.label}&quot;
            </button>
          </>
        )}
      </div>

      {(adding || editingId) && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.label.trim()) return;
            if (editingId) {
              const id = editingId;
              startTransition(async () => {
                await updateDependencyNode(moduleId, id, { ...form, assetId: form.assetId || null });
              });
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === id
                    ? { ...n, label: form.label.trim(), category: form.category.trim() || null, shape: form.shape, assetId: form.assetId || null }
                    : n
                )
              );
              setEditingId(null);
            } else {
              // Drop the new node at the center of whatever's currently in view,
              // not the home position — otherwise it can land off-screen once
              // someone's panned or zoomed around a larger graph.
              const x = (CANVAS_W / 2 - pan.x) / zoom + (Math.random() - 0.5) * (80 / zoom);
              const y = (CANVAS_H / 2 - pan.y) / zoom + (Math.random() - 0.5) * (80 / zoom);
              startTransition(async () => {
                await createDependencyNode(moduleId, { ...form, assetId: form.assetId || null, x, y });
              });
              setNodes((prev) => [
                ...prev,
                { id: `temp-${Date.now()}`, assetId: form.assetId || null, label: form.label.trim(), category: form.category.trim() || null, shape: form.shape, x, y },
              ]);
              setAdding(false);
            }
            setForm({ label: "", category: "", shape: "circle", assetId: "" });
          }}
        >
          <label className="space-y-1 text-xs text-zinc-500">
            Name
            <input autoFocus className={inputCls} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </label>
          <label className="space-y-1 text-xs text-zinc-500">
            Category
            <input className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. puzzle logic" />
          </label>
          <label className="space-y-1 text-xs text-zinc-500">
            Shape
            <select className={inputCls} value={form.shape} onChange={(e) => setForm((f) => ({ ...f, shape: e.target.value as DependencyNodeShape }))}>
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="diamond">Diamond</option>
              <option value="hexagon">Hexagon</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-zinc-500">
            Linked asset
            <select className={inputCls} value={form.assetId} onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}>
              <option value="">None</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={primaryBtn}>
            {editingId ? "Save" : "Add"}
          </button>
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              setAdding(false);
              setEditingId(null);
              setForm({ label: "", category: "", shape: "circle", assetId: "" });
            }}
          >
            Cancel
          </button>
        </form>
      )}

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="dg-canvas w-full rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
          style={{ touchAction: "none" }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
          onClick={(e) => {
            // A click on a node bubbles here too (stopPropagation on pointerdown
            // doesn't stop the separate click event) — only clear selection when
            // the click actually landed on empty canvas.
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <defs>
            <marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-zinc-400 dark:fill-zinc-500" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {edges.map((e) => {
              const from = nodes.find((n) => n.id === e.fromNodeId);
              const to = nodes.find((n) => n.id === e.toNodeId);
              if (!from || !to) return null;
              return (
                <g key={e.id}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="stroke-zinc-400 dark:stroke-zinc-500"
                    strokeWidth={2 / zoom}
                    markerEnd="url(#dg-arrow)"
                  />
                  <circle
                    cx={(from.x + to.x) / 2}
                    cy={(from.y + to.y) / 2}
                    r={7 / zoom}
                    className="cursor-pointer fill-zinc-300 hover:fill-red-400 dark:fill-zinc-700 dark:hover:fill-red-500"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      startTransition(() => void deleteDependencyEdge(moduleId, e.id));
                      setEdges((prev) => prev.filter((x) => x.id !== e.id));
                    }}
                  >
                    <title>Remove this link</title>
                  </circle>
                </g>
              );
            })}
            {nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
              >
                <NodeShape shape={n.shape} size={NODE_SIZE} fill={categoryColorVar(n.category, categoryOrder)} />
                {selected === n.id && (
                  <NodeShape shape={n.shape} size={NODE_SIZE + 10} fill="none" stroke="var(--dg-neutral)" />
                )}
                <text
                  textAnchor="middle"
                  dy={NODE_SIZE / 2 + 16}
                  className="fill-zinc-700 font-medium dark:fill-zinc-300"
                  style={{ fontSize: 11 / zoom }}
                >
                  {n.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <button type="button" className={iconBtn} title="Zoom in" onClick={() => zoomAt(svgRef.current!.getBoundingClientRect().left + svgRef.current!.getBoundingClientRect().width / 2, svgRef.current!.getBoundingClientRect().top + svgRef.current!.getBoundingClientRect().height / 2, 1.3)}>
            +
          </button>
          <button type="button" className={iconBtn} title="Zoom out" onClick={() => zoomAt(svgRef.current!.getBoundingClientRect().left + svgRef.current!.getBoundingClientRect().width / 2, svgRef.current!.getBoundingClientRect().top + svgRef.current!.getBoundingClientRect().height / 2, 1 / 1.3)}>
            −
          </button>
          <button type="button" className={`${iconBtn} text-xs`} title="Reset view" onClick={resetView}>
            ⟲
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Drag a node to arrange it, drag empty space to pan, scroll to zoom. Select a node to link or delete it.
        Positions save automatically.
      </p>
    </div>
  );
}
