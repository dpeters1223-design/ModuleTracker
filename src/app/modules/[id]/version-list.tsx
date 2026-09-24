"use client";

import { useState, useTransition } from "react";
import { formatDay } from "@/lib/task-format";
import { addVersion, deleteVersion, type VersionInput } from "./version-actions";

export type VersionRow = VersionInput & { id: string };

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`;

const blank: VersionInput = {
  version: "",
  platform: "",
  workspace: "",
  experienceId: "",
  launchUrl: "",
  releasedAt: "",
  notes: "",
};

/** Published builds of the module, newest first (the first row is the current version). */
export function VersionList({
  moduleId,
  versions,
  today,
}: {
  moduleId: string;
  versions: VersionRow[];
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof VersionInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const field = (k: keyof VersionInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="space-y-1 text-xs text-zinc-500">
      {label}
      <input className={inputCls} value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {versions.length ? `Current: ${versions[0].version}` : "No published versions yet."}
        </p>
        {!adding && (
          <button type="button" className={secondaryBtn} onClick={() => setAdding(true)}>
            + Add version
          </button>
        )}
      </div>

      {adding && (
        <form
          className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await addVersion(moduleId, form);
              if (res.errors?.length) return setErrors(res.errors);
              setErrors([]);
              setForm(blank);
              setAdding(false);
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
          <div className="grid gap-3 sm:grid-cols-3">
            {field("version", "Version *", { placeholder: "e.g. v3.01", autoFocus: true })}
            {field("releasedAt", "Released", { type: "date" })}
            {field("platform", "Platform", { placeholder: "e.g. Uptale" })}
            {field("workspace", "Workspace")}
            {field("experienceId", "Experience ID")}
          </div>
          {field("launchUrl", "Launch link", { type: "url", placeholder: "https://…" })}
          <label className="block space-y-1 text-xs text-zinc-500">
            What changed
            <textarea
              className={`${inputCls} min-h-16`}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={pending}>
              {pending ? "Saving…" : "Add version"}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setErrors([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {versions.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {versions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">
                  {v.version}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                      Current
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {[
                    v.releasedAt && `Released ${formatDay(v.releasedAt, today)}`,
                    v.platform,
                    v.workspace,
                    v.experienceId && `ID ${v.experienceId}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {v.notes && <p className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{v.notes}</p>}
              </div>
              <div className="flex shrink-0 items-baseline gap-3">
                {v.launchUrl && (
                  <a
                    href={v.launchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
                  >
                    Launch ↗
                  </a>
                )}
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete version ${v.version} from the history?`)) return;
                    startTransition(async () => {
                      await deleteVersion(moduleId, v.id);
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
