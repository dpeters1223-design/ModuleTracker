"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { AssetStatus } from "@prisma/client";
import { ASSET_TYPE_LABELS, ASSET_TYPES, isInHand } from "@/lib/assets";
import { AttachImagePanel, TaskImages, type TaskImage } from "@/components/task-images";
import {
  addAssetsFromScenes,
  createAsset,
  deleteAsset,
  setAssetStatus,
  updateAsset,
  type AssetInput,
  type AssetResult,
} from "./asset-actions";

export type AssetRow = AssetInput & { id: string; images: TaskImage[] };
export type SceneOption = { id: string; label: string };

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";

/** The checklist tick: expected ↔ received. Unticking also clears "In Uptale". */
export function ReceivedCheckbox({
  moduleId,
  assetId,
  name,
  status,
}: {
  moduleId: string;
  assetId: string;
  name: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(status);
  const received = isInHand(shown as AssetStatus);
  return (
    <input
      type="checkbox"
      aria-label={`${name}: received`}
      title={received ? "Received (untick if it hasn't arrived)" : "Tick when it's received"}
      checked={received}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked ? "received" : "needed";
        startTransition(async () => {
          setShown(next);
          await setAssetStatus(moduleId, assetId, next);
        });
      }}
      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-green-700 disabled:cursor-wait"
    />
  );
}

/** The optional second tick, once an asset is received: built into Uptale. */
function InUptaleCheckbox({ moduleId, assetId, name, status }: { moduleId: string; assetId: string; name: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(status);
  return (
    <label className="inline-flex cursor-pointer items-center gap-1">
      <input
        type="checkbox"
        aria-label={`${name}: in Uptale`}
        checked={shown === "in_uptale"}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked ? "in_uptale" : "received";
          startTransition(async () => {
            setShown(next);
            await setAssetStatus(moduleId, assetId, next);
          });
        }}
        className="h-3.5 w-3.5 cursor-pointer accent-green-700"
      />
      In Uptale
    </label>
  );
}

function AssetForm({
  initial,
  scenes,
  owners,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: AssetInput;
  scenes: SceneOption[];
  owners: string[];
  submitLabel: string;
  onSubmit: (input: AssetInput) => Promise<AssetResult>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof AssetInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="space-y-3 rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await onSubmit(form);
          if (res.errors?.length) setErrors(res.errors);
        });
      }}
    >
      {errors.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-sm text-red-700 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <input
        className={inputCls}
        placeholder="Asset, e.g. Close-up photo of the sputter target"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        autoFocus
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-zinc-500">
          Type
          <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Scene
          <select className={inputCls} value={form.sceneId} onChange={(e) => set("sceneId", e.target.value)}>
            <option value="">Not tied to a scene</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Who&apos;s providing it
          <input className={inputCls} list="asset-owner-options" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-zinc-500 sm:col-span-2">
          Link (optional: Drive, Box, a video…)
          <input className={inputCls} type="url" placeholder="https://" value={form.url} onChange={(e) => set("url", e.target.value)} />
        </label>
      </div>
      <textarea
        className={`${inputCls} min-h-16`}
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
      />
      <datalist id="asset-owner-options">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <button type="submit" className={primaryBtn} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button type="button" className={secondaryBtn} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AssetLine({
  moduleId,
  asset,
  onEdit,
}: {
  moduleId: string;
  asset: AssetRow;
  onEdit: () => void;
}) {
  const [attaching, setAttaching] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-start gap-3">
      <ReceivedCheckbox moduleId={moduleId} assetId={asset.id} name={asset.name} status={asset.status} />
      <div className="order-last min-w-0 flex-1 basis-full sm:order-none sm:basis-0">
        <p className={`text-sm ${asset.status === "in_uptale" ? "text-zinc-500" : "font-medium"}`}>{asset.name}</p>
        <p className="text-xs text-zinc-500">
          {[ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS], asset.owner].filter(Boolean).join(" · ")}
          {isInHand(asset.status as AssetStatus) && (
            <>
              {" · "}
              <span className="font-medium text-green-800 dark:text-green-400">✓ Received</span>
              {" · "}
              <InUptaleCheckbox moduleId={moduleId} assetId={asset.id} name={asset.name} status={asset.status} />
            </>
          )}
          {asset.status === "requested" && <span className="text-amber-700 dark:text-amber-400"> · Requested</span>}
          {asset.url && (
            <>
              {" · "}
              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
                Open link ↗
              </a>
            </>
          )}
        </p>
        {asset.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{asset.notes}</p>}
        <TaskImages moduleId={moduleId} images={asset.images} />
        {attaching && (
          <AttachImagePanel moduleId={moduleId} target={{ kind: "asset", id: asset.id }} onDone={() => setAttaching(false)} />
        )}
      </div>
      <div className="ml-auto flex gap-3 sm:ml-0">
        <button type="button" className={linkBtn} onClick={() => setAttaching(true)}>
          Attach image
        </button>
        <button type="button" className={linkBtn} onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className={linkBtn}
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete asset "${asset.name}"?`)) return;
            startTransition(async () => {
              await deleteAsset(moduleId, asset.id);
            });
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** The module's asset checklist, grouped by scene, with progress and "Add from scenes". */
export function AssetList({
  moduleId,
  assets,
  scenes,
  owners,
  fromScenes,
}: {
  moduleId: string;
  assets: AssetRow[];
  scenes: SceneOption[];
  owners: string[];
  /** How many assets the scenes call for that aren't listed yet. */
  fromScenes: number;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  const inHand = assets.filter((a) => isInHand(a.status as AssetStatus)).length;
  const built = assets.filter((a) => a.status === "in_uptale").length;
  const groups = [
    ...scenes.map((s) => ({ key: s.id, label: s.label, items: assets.filter((a) => a.sceneId === s.id) })),
    { key: "none", label: "Not tied to a scene", items: assets.filter((a) => !a.sceneId || !scenes.some((s) => s.id === a.sceneId)) },
  ].filter((g) => g.items.length);
  const blank: AssetInput = { name: "", type: "image2d", sceneId: "", owner: "", status: "needed", url: "", notes: "" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {assets.length === 0 ? (
            "No assets listed yet."
          ) : (
            <>
              {inHand} of {assets.length} received · {built} in Uptale
            </>
          )}
          {note && <span className="ml-2 text-green-700 dark:text-green-400">{note}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {fromScenes > 0 && (
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              title="Adds a row for each 2D image, 2D video, 3D object and media asset the scenes mention that isn't listed yet"
              onClick={() =>
                startTransition(async () => {
                  const res = await addAssetsFromScenes(moduleId);
                  setNote(res.added ? `Added ${res.added} from the scenes.` : "");
                })
              }
            >
              {pending ? "Adding…" : `Add ${fromScenes} from scenes`}
            </button>
          )}
          {!adding && (
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                setEditingId(null);
                setAdding(true);
              }}
            >
              + Add asset
            </button>
          )}
        </div>
      </div>

      {adding && (
        <AssetForm
          initial={blank}
          scenes={scenes}
          owners={owners}
          submitLabel="Add asset"
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const res = await createAsset(moduleId, input);
            if (!res.errors?.length) setAdding(false);
            return res;
          }}
        />
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h3 className="text-sm font-semibold">
            {g.label}{" "}
            <span className="text-xs font-normal text-zinc-500">
              {g.items.filter((a) => isInHand(a.status as AssetStatus)).length}/{g.items.length} received
            </span>
          </h3>
          <ul className="divide-y divide-zinc-300 rounded-lg border border-zinc-300 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-950">
            {g.items.map((asset) => (
              <li
                key={asset.id}
                className={`px-3 py-2.5 ${isInHand(asset.status as AssetStatus) ? "bg-green-50/70 dark:bg-green-950/25" : ""}`}
              >
                {editingId === asset.id ? (
                  <AssetForm
                    initial={asset}
                    scenes={scenes}
                    owners={owners}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (input) => {
                      const res = await updateAsset(moduleId, asset.id, input);
                      if (!res.errors?.length) setEditingId(null);
                      return res;
                    }}
                  />
                ) : (
                  <AssetLine
                    moduleId={moduleId}
                    asset={asset}
                    onEdit={() => {
                      setAdding(false);
                      setEditingId(asset.id);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
