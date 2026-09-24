"use client";

import { useState, useTransition } from "react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { addDocumentLink, removeDocumentLink } from "./document-actions";

export type DocumentRow = { id: string; type: string; label: string | null; url: string; addedBy: string | null };

const TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as (keyof typeof DOCUMENT_TYPE_LABELS)[];

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`;

/** Link text: the label, else the site name (e.g. "docs.google.com"). */
const linkText = (d: DocumentRow) => {
  if (d.label) return d.label;
  try {
    return new URL(d.url).hostname.replace(/^www\./, "");
  } catch {
    return d.url;
  }
};

export function DocumentList({ moduleId, documents }: { moduleId: string; documents: DocumentRow[] }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: "storyboard", label: "", url: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const groups = TYPES.map((type) => ({ type, docs: documents.filter((d) => d.type === type) })).filter(
    (g) => g.docs.length
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {documents.length
            ? `${documents.length} link${documents.length === 1 ? "" : "s"}`
            : "No documents linked yet."}
        </p>
        {!adding && (
          <button type="button" className={secondaryBtn} onClick={() => setAdding(true)}>
            + Add link
          </button>
        )}
      </div>

      {adding && (
        <form
          className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await addDocumentLink(moduleId, form);
              if (res.errors?.length) return setErrors(res.errors);
              setErrors([]);
              setForm((f) => ({ ...f, label: "", url: "" }));
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
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <select
              aria-label="Document type"
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              aria-label="Label"
              className={inputCls}
              placeholder="Label (optional), e.g. Storyboard v2"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <input
            aria-label="Link"
            type="url"
            required
            className={`${inputCls} w-full`}
            placeholder="https://docs.google.com/… or a Box link"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={pending}>
              {pending ? "Saving…" : "Add link"}
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

      {groups.length > 0 && (
        <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {groups.map(({ type, docs }) => (
            <div key={type} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
              <dt className="text-sm text-zinc-500">{DOCUMENT_TYPE_LABELS[type]}</dt>
              <dd>
                <ul className="space-y-1">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
                        title={d.addedBy ? `Added by ${d.addedBy}` : undefined}
                      >
                        {linkText(d)} ↗
                      </a>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Remove "${linkText(d)}" from this module? The document itself isn't deleted.`))
                            return;
                          startTransition(async () => {
                            await removeDocumentLink(moduleId, d.id);
                          });
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
