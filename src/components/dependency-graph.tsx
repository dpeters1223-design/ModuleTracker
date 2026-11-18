"use client";

import { useRef, useState, useTransition } from "react";
import type { DependencyNodeShape } from "@prisma/client";
import {
  createDependencyEdge,
  createDependencyNode,
  deleteDependencyEdge,
  deleteDependencyNode,
  moveDependencyNode,
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

const CANVAS_W = 900;
const CANVAS_H = 500;
const NODE_SIZE = 64;

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
  // Re-sync from fresh server data (e.g. after revalidation) without an effect —
  // adjusting state during render, per https://react.dev/learn/you-might-not-need-an-effect.
  if (graph !== prevGraph) {
    setPrevGraph(graph);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }

  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", category: "", shape: "circle" as DependencyNodeShape, assetId: "" });
  const [, startTransition] = useTransition();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryOrder = [...new Set(nodes.map((n) => n.category).filter((c): c is string => Boolean(c)))];

  function toSvgPoint(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { x: Math.max(NODE_SIZE / 2, Math.min(CANVAS_W - NODE_SIZE / 2, x)), y: Math.max(NODE_SIZE / 2, Math.min(CANVAS_H - NODE_SIZE / 2, y)) };
  }

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

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (!dragId.current) return;
    const { x, y } = toSvgPoint(e);
    const id = dragId.current;
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    persistMove(id, x, y);
  }

  function onCanvasPointerUp() {
    dragId.current = null;
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
        <button type="button" className={secondaryBtn} onClick={() => setAdding((v) => !v)}>
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
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              startTransition(() => void deleteDependencyNode(moduleId, selectedNode.id));
              setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
              setSelected(null);
            }}
          >
            Delete &quot;{selectedNode.label}&quot;
          </button>
        )}
      </div>

      {adding && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.label.trim()) return;
            const x = CANVAS_W / 2 + (Math.random() - 0.5) * 100;
            const y = CANVAS_H / 2 + (Math.random() - 0.5) * 100;
            startTransition(async () => {
              await createDependencyNode(moduleId, { ...form, assetId: form.assetId || null, x, y });
            });
            setNodes((prev) => [
              ...prev,
              { id: `temp-${Date.now()}`, assetId: form.assetId || null, label: form.label.trim(), category: form.category.trim() || null, shape: form.shape, x, y },
            ]);
            setForm({ label: "", category: "", shape: "circle", assetId: "" });
            setAdding(false);
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
            Add
          </button>
        </form>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        className="dg-canvas w-full rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
        style={{ touchAction: "none" }}
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
                strokeWidth={2}
                markerEnd="url(#dg-arrow)"
              />
              <circle
                cx={(from.x + to.x) / 2}
                cy={(from.y + to.y) / 2}
                r={7}
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
            <text textAnchor="middle" dy={NODE_SIZE / 2 + 16} className="fill-zinc-700 text-[11px] font-medium dark:fill-zinc-300">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-zinc-500">
        Drag to arrange, select a node to link or delete it. Positions save automatically.
      </p>
    </div>
  );
}
