"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createFeatureRequest,
  deleteFeatureRequest,
  setFeatureRequestStatus,
  type FeatureRequestResult,
} from "@/app/requests/actions";
import { prepareFeatureRequestAttachmentUpload, registerFeatureRequestAttachment } from "@/app/requests/attachment-actions";
import { CLOSED_FEATURE_REQUEST_STATUSES, FEATURE_REQUEST_STATUS_LABELS } from "@/lib/labels";
import { isImageMime } from "@/lib/attachments";
import {
  FeatureRequestAttachPanel,
  FeatureRequestAttachmentList,
  shrink,
  uploadToDrive,
  type FeatureRequestAttachmentRow,
} from "@/components/feature-request-attachments";

export type EntityOption = { id: string; label: string };

export type FeatureRequestRow = {
  id: string;
  title: string;
  body: string;
  status: keyof typeof FEATURE_REQUEST_STATUS_LABELS;
  submittedByName: string | null;
  createdAt: string;
  module: EntityOption | null;
  task: (EntityOption & { moduleId: string }) | null;
  mediaItem: EntityOption | null;
  documentLink: (EntityOption & { moduleId: string }) | null;
  attachments: FeatureRequestAttachmentRow[];
};

const STATUSES = Object.keys(FEATURE_REQUEST_STATUS_LABELS) as (keyof typeof FEATURE_REQUEST_STATUS_LABELS)[];
const isClosed = (status: string) => (CLOSED_FEATURE_REQUEST_STATUSES as string[]).includes(status);

const STATUS_STYLES: Record<string, string> = {
  new: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  planned: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  declined: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";
const chipCls =
  "rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

function RequestForm({
  modules,
  tasks,
  mediaItems,
  scripts,
  onCancel,
}: {
  modules: EntityOption[];
  tasks: EntityOption[];
  mediaItems: EntityOption[];
  scripts: EntityOption[];
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [mediaItemId, setMediaItemId] = useState("");
  const [documentLinkId, setDocumentLinkId] = useState("");
  const [picked, setPicked] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const select = (value: string, onChange: (v: string) => void, options: EntityOption[], placeholder: string) => (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res: FeatureRequestResult = await createFeatureRequest(title, body, { moduleId, taskId, mediaItemId, documentLinkId });
          if (res.errors?.length) return setErrors(res.errors);
          setErrors([]);
          if (res.id && picked.length) {
            const upload = await prepareFeatureRequestAttachmentUpload(res.id);
            if (upload.accessToken) {
              for (const original of picked) {
                const file = isImageMime(original.type) ? await shrink(original) : original;
                try {
                  const fileId = await uploadToDrive(file, { accessToken: upload.accessToken, folderId: upload.folderId });
                  await registerFeatureRequestAttachment(res.id, fileId);
                } catch {
                  // Request is already submitted either way — a failed image upload shouldn't look like a failed submission.
                }
              }
            }
          }
          onCancel();
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
        What&apos;s the idea? *
        <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <textarea
        className={`${inputCls} min-h-24`}
        placeholder="Any more detail — why it'd help, what it should do (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-zinc-500">
          Tag a module
          {select(moduleId, setModuleId, modules, "None")}
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Tag a task
          {select(taskId, setTaskId, tasks, "None")}
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Tag a piece of media
          {select(mediaItemId, setMediaItemId, mediaItems, "None")}
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Tag a script
          {select(documentLinkId, setDocumentLinkId, scripts, "None")}
        </label>
      </div>
      <FeatureRequestAttachPanel pickedCount={picked.length} onPick={(files) => setPicked((prev) => [...prev, ...files])} />
      <div className="flex gap-2">
        <button type="submit" className={primaryBtn} disabled={pending || !title.trim()}>
          {pending ? "Submitting…" : "Submit"}
        </button>
        <button type="button" className={secondaryBtn} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function FeatureRequestList({
  items,
  modules,
  tasks,
  mediaItems,
  scripts,
}: {
  items: FeatureRequestRow[];
  modules: EntityOption[];
  tasks: EntityOption[];
  mediaItems: EntityOption[];
  scripts: EntityOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = items.filter((r) => !isClosed(r.status));
  const closed = items.filter((r) => isClosed(r.status));

  const tags = (r: FeatureRequestRow) => {
    const chips: { href: string; label: string }[] = [];
    if (r.module) chips.push({ href: `/modules/${r.module.id}`, label: r.module.label });
    if (r.task) chips.push({ href: `/modules/${r.task.moduleId}/tasks/${r.task.id}`, label: r.task.label });
    if (r.mediaItem) chips.push({ href: `/media`, label: r.mediaItem.label });
    if (r.documentLink) chips.push({ href: `/scripts/${r.documentLink.moduleId}`, label: r.documentLink.label });
    if (!chips.length) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Link key={c.href + c.label} href={c.href} className={chipCls}>
            {c.label}
          </Link>
        ))}
      </div>
    );
  };

  const row = (r: FeatureRequestRow) => (
    <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
      <select
        aria-label="Request status"
        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
        value={r.status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setFeatureRequestStatus(r.id, next);
          });
        }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {FEATURE_REQUEST_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isClosed(r.status) ? "text-zinc-500" : "font-medium"}`}>{r.title}</p>
        {r.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{r.body}</p>}
        <p className="text-xs text-zinc-500">
          {r.submittedByName && `${r.submittedByName} · `}
          {r.createdAt}
        </p>
        {tags(r)}
        <FeatureRequestAttachmentList attachments={r.attachments} />
      </div>
      <button
        type="button"
        className={linkBtn}
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this request?")) return;
          startTransition(async () => {
            await deleteFeatureRequest(r.id);
          });
        }}
      >
        Delete
      </button>
    </li>
  );

  const list = (rows: FeatureRequestRow[]) => (
    <ul className="divide-y divide-zinc-300 rounded-lg border border-zinc-300 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-950">
      {rows.map(row)}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {items.length ? `${open.length} open · ${closed.length} closed` : "Nothing submitted yet."}
        </p>
        {!adding && (
          <button type="button" className={secondaryBtn} onClick={() => setAdding(true)}>
            + New request
          </button>
        )}
      </div>

      {adding && (
        <RequestForm modules={modules} tasks={tasks} mediaItems={mediaItems} scripts={scripts} onCancel={() => setAdding(false)} />
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
