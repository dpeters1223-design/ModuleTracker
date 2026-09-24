"use client";

import { useState, useTransition } from "react";
import {
  createChangeOrder,
  deleteChangeOrder,
  setChangeOrderStatus,
  updateChangeOrder,
  type ChangeOrderInput,
  type ChangeOrderResult,
} from "@/app/changes/actions";
import { CHANGE_ORDER_STATUS_LABELS, CLOSED_CHANGE_ORDER_STATUSES } from "@/lib/labels";
import { formatDay } from "@/lib/task-format";

export type ChangeOrderRow = ChangeOrderInput & { id: string; moduleLabel: string | null };

const STATUSES = Object.keys(CHANGE_ORDER_STATUS_LABELS) as (keyof typeof CHANGE_ORDER_STATUS_LABELS)[];
const isClosed = (status: string) => (CLOSED_CHANGE_ORDER_STATUSES as string[]).includes(status);

const STATUS_STYLES: Record<string, string> = {
  suggested: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  approved: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  deferred: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  declined: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";

function ChangeOrderForm({
  initial,
  modules,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ChangeOrderInput;
  modules: { id: string; label: string }[];
  submitLabel: string;
  onSubmit: (input: ChangeOrderInput) => Promise<ChangeOrderResult>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ChangeOrderInput>(k: K, v: ChangeOrderInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof ChangeOrderInput, label: string, type = "text") => (
    <label className="space-y-1 text-xs text-zinc-500">
      {label}
      <input
        type={type}
        className={inputCls}
        value={form[k] as string}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </label>
  );

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
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
      <label className="block space-y-1 text-xs text-zinc-500">
        What should change? *
        <textarea
          className={`${inputCls} min-h-16`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          autoFocus
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-zinc-500">
          Module
          <select className={inputCls} value={form.moduleId} onChange={(e) => set("moduleId", e.target.value)}>
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {text("sceneRef", "Scene(s), e.g. Scene 2 or All scenes")}
        <label className="space-y-1 text-xs text-zinc-500">
          Status
          <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CHANGE_ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {text("suggestedBy", "Suggested by")}
        {text("suggestedDate", "Suggested on", "date")}
        {text("goalDate", "Goal date", "date")}
        {text("approvedBy", "Approved by")}
        {text("completedDate", "Completed on", "date")}
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={form.versionUpdated}
            onChange={(e) => set("versionUpdated", e.target.checked)}
          />
          Version number updated
        </label>
      </div>
      <textarea
        className={`${inputCls} min-h-16`}
        placeholder="Longer description / notes (optional)"
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
      />
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

/**
 * Change order log. On a module page pass `defaultModuleId` (new entries default to that
 * module); on the Changes page omit it and set `showModule` to label each row.
 */
export function ChangeOrderList({
  items,
  modules,
  today,
  defaultModuleId = "",
  showModule = false,
}: {
  items: ChangeOrderRow[];
  modules: { id: string; label: string }[];
  today: string;
  defaultModuleId?: string;
  showModule?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = items.filter((c) => !isClosed(c.status));
  const closed = items.filter((c) => isClosed(c.status));
  const blank: ChangeOrderInput = {
    moduleId: defaultModuleId,
    description: "",
    sceneRef: "",
    status: "suggested",
    suggestedBy: "",
    suggestedDate: today,
    goalDate: "",
    approvedBy: "",
    completedDate: "",
    versionUpdated: false,
    notes: "",
  };

  const row = (c: ChangeOrderRow) =>
    editingId === c.id ? (
      <li key={c.id} className="p-2">
        <ChangeOrderForm
          initial={c}
          modules={modules}
          submitLabel="Save"
          onCancel={() => setEditingId(null)}
          onSubmit={async (input) => {
            const res = await updateChangeOrder(c.id, input);
            if (!res.errors?.length) setEditingId(null);
            return res;
          }}
        />
      </li>
    ) : (
      <li key={c.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
        <select
          aria-label="Change order status"
          className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}
          value={c.status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            startTransition(async () => {
              await setChangeOrderStatus(c.id, next);
            });
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {CHANGE_ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="min-w-0 flex-1">
          <p className={`whitespace-pre-wrap text-sm ${isClosed(c.status) ? "text-zinc-500" : "font-medium"}`}>
            {c.description}
          </p>
          <p className="text-xs text-zinc-500">
            {[
              showModule || !c.moduleId ? (c.moduleLabel ?? "All modules") : null,
              c.sceneRef,
              c.suggestedBy &&
                `Suggested by ${c.suggestedBy}${c.suggestedDate ? ` on ${formatDay(c.suggestedDate, today)}` : ""}`,
              c.approvedBy && `Approved by ${c.approvedBy}`,
              c.goalDate && !isClosed(c.status) && `Goal ${formatDay(c.goalDate, today)}`,
              c.completedDate && `Completed ${formatDay(c.completedDate, today)}`,
              c.versionUpdated && "Version updated",
            ]
              .filter(Boolean)
              .join(" · ")}
            {c.goalDate && !isClosed(c.status) && c.goalDate < today && (
              <span className="ml-1 font-medium text-red-700 dark:text-red-400">Past goal date</span>
            )}
          </p>
          {c.notes && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{c.notes}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className={linkBtn}
            onClick={() => {
              setAdding(false);
              setEditingId(c.id);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={linkBtn}
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this change order?")) return;
              startTransition(async () => {
                await deleteChangeOrder(c.id);
              });
            }}
          >
            Delete
          </button>
        </div>
      </li>
    );

  const list = (rows: ChangeOrderRow[]) => (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {rows.map(row)}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {items.length ? `${open.length} open · ${closed.length} closed` : "No change orders yet."}
        </p>
        {!adding && (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            + Add change order
          </button>
        )}
      </div>

      {adding && (
        <ChangeOrderForm
          initial={blank}
          modules={modules}
          submitLabel="Add change order"
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const res = await createChangeOrder(input);
            if (!res.errors?.length) setAdding(false);
            return res;
          }}
        />
      )}

      {open.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Open</h3>
          {list(open)}
        </section>
      )}
      {closed.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-500">Closed</h3>
          {list(closed)}
        </section>
      )}
    </div>
  );
}
