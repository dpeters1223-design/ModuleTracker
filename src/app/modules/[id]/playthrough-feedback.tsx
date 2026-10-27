"use client";

import { useState, useTransition } from "react";
import { submitPlaythroughFeedback, updatePlaythroughFeedback } from "./feedback-actions";

export type FeedbackRow = {
  id: string;
  authorName: string | null;
  /** Already formatted server-side, in the team's time zone. */
  when: string;
  body: string;
  /** Whether the person reading this is the one who wrote it. */
  mine: boolean;
};

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;

function Entry({ moduleId, entry }: { moduleId: string; entry: FeedbackRow }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(entry.body);
  const [expanded, setExpanded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  // Transcripts run long; show the opening and let people open the rest.
  const long = entry.body.length > 900;

  if (editing) {
    return (
      <form
        className="space-y-2 rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await updatePlaythroughFeedback(moduleId, entry.id, body);
            if (res.errors?.length) return setErrors(res.errors);
            setErrors([]);
            setEditing(false);
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
        <textarea
          aria-label="Playthrough write-up"
          className={`${inputCls} min-h-64 font-mono text-xs leading-relaxed`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="submit" className={primaryBtn} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className={secondaryBtn}
            disabled={pending}
            onClick={() => {
              setBody(entry.body);
              setEditing(false);
              setErrors([]);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <header className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{entry.authorName ?? "Someone"}</p>
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="text-xs text-zinc-500">{entry.when}</span>
          {entry.mine && (
            <button type="button" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </header>
      <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
        {long && !expanded ? `${entry.body.slice(0, 900)}…` : entry.body}
      </p>
      {long && (
        <button
          type="button"
          className="mt-1.5 text-xs font-medium text-brand hover:underline dark:text-gold"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Read the whole write-up"}
        </button>
      )}
    </article>
  );
}

/** The feedback tab on a playthrough task: every write-up, and a box to add one. */
export function PlaythroughFeedback({
  moduleId,
  taskId,
  taskTitle,
  entries,
}: {
  moduleId: string;
  taskId: string;
  taskTitle: string;
  entries: FeedbackRow[];
}) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-teal bg-teal-light px-2.5 py-1 text-xs font-semibold text-brand dark:border-teal dark:bg-teal/20 dark:text-teal-light"
      >
        Playthrough feedback{entries.length > 0 && ` · ${entries.length}`}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          {entries.length === 0 && !writing && (
            <p className="text-sm text-zinc-500">
              Nothing written up yet for “{taskTitle}”.
            </p>
          )}
          {entries.map((e) => (
            <Entry key={e.id} moduleId={moduleId} entry={e} />
          ))}

          {writing ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const res = await submitPlaythroughFeedback(moduleId, taskId, body);
                  if (res.errors?.length) return setErrors(res.errors);
                  setErrors([]);
                  setBody("");
                  setWriting(false);
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
              <textarea
                autoFocus
                aria-label="Playthrough write-up"
                className={`${inputCls} min-h-64 font-mono text-xs leading-relaxed`}
                placeholder="Paste or type the write-up — what you did, what you saw, where the instructions tripped you up…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="submit" className={primaryBtn} disabled={pending || !body.trim()}>
                  {pending ? "Submitting…" : "Submit feedback"}
                </button>
                <button
                  type="button"
                  className={secondaryBtn}
                  disabled={pending}
                  onClick={() => {
                    setWriting(false);
                    setErrors([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className={primaryBtn} onClick={() => setWriting(true)}>
              Submit feedback
            </button>
          )}
        </div>
      )}
    </div>
  );
}
