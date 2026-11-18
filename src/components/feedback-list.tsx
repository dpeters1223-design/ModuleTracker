"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { FeedbackCategory } from "@prisma/client";
import { sortPlaythroughFeedback } from "@/app/modules/[id]/feedback-actions";
import { FEEDBACK_CATEGORY_LABELS } from "@/lib/labels";

export type FeedbackTag = { quote: string; category: FeedbackCategory };

export type FeedbackRow = {
  id: string;
  moduleId: string;
  moduleLabel: string;
  taskId: string;
  taskTitle: string;
  authorName: string | null;
  when: string;
  body: string;
  categories: FeedbackCategory[];
  tags: FeedbackTag[];
  mine: boolean;
};

const CATEGORY_STYLES: Record<FeedbackCategory, string> = {
  instructional_design: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ui_ux: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  media: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  tags: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

/** Fixed order — matches the bubble chart's slots, never re-sorted by count. */
const CATEGORY_ORDER: FeedbackCategory[] = ["instructional_design", "ui_ux", "media", "tags"];

function Badge({ category }: { category: FeedbackCategory }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category]}`}>
      {FEEDBACK_CATEGORY_LABELS[category]}
    </span>
  );
}

/**
 * Splits displayed text into plain/highlighted runs from the tagged quotes.
 * Quotes are located fresh in whatever substring is actually on screen (so a
 * quote cut off by truncation just doesn't highlight there, rather than
 * crashing or highlighting the wrong span) and overlaps are resolved by
 * keeping the earliest-starting match and dropping anything it overlaps.
 */
function highlightBody(text: string, tags: FeedbackTag[]): ReactNode {
  const matches = tags
    .map((t) => {
      const start = text.indexOf(t.quote);
      return start === -1 ? null : { start, end: start + t.quote.length, category: t.category };
    })
    .filter((m): m is { start: number; end: number; category: FeedbackCategory } => m !== null)
    .sort((a, b) => a.start - b.start);

  const kept: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      kept.push(m);
      lastEnd = m.end;
    }
  }
  if (!kept.length) return text;

  const pieces: ReactNode[] = [];
  let cursor = 0;
  kept.forEach((m, i) => {
    if (m.start > cursor) pieces.push(text.slice(cursor, m.start));
    pieces.push(
      <mark
        key={i}
        title={FEEDBACK_CATEGORY_LABELS[m.category]}
        className={`rounded px-0.5 ${CATEGORY_STYLES[m.category]}`}
      >
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces;
}

function Entry({ entry, showModule }: { entry: FeedbackRow; showModule: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [categories, setCategories] = useState(entry.categories);
  const [tags, setTags] = useState(entry.tags);
  const long = entry.body.length > 900;
  const shown = long && !expanded ? `${entry.body.slice(0, 900)}…` : entry.body;

  return (
    <article className="rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <header className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{entry.authorName ?? "Someone"}</p>
          <p className="text-xs text-zinc-500">
            {showModule && (
              <>
                <Link href={`/modules/${entry.moduleId}`} className="hover:underline">
                  {entry.moduleLabel}
                </Link>
                {" · "}
              </>
            )}
            {entry.taskTitle} · {entry.when}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {CATEGORY_ORDER.filter((c) => categories.includes(c)).map((c) => (
            <Badge key={c} category={c} />
          ))}
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await sortPlaythroughFeedback(entry.moduleId, entry.id);
                if (res.categories) setCategories(res.categories);
                if (res.tags) setTags(res.tags);
              });
            }}
          >
            {pending ? "Sorting…" : "AI Sort"}
          </button>
        </div>
      </header>
      <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{highlightBody(shown, tags)}</p>
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

/**
 * Every playthrough write-up in one place — used both on a module's page (its own
 * feedback only) and on the global /feedback page (across every module).
 */
export function FeedbackList({ rows, showModule = false }: { rows: FeedbackRow[]; showModule?: boolean }) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500">No playthrough feedback yet.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Entry key={r.id} entry={r} showModule={showModule} />
      ))}
    </div>
  );
}

export { CATEGORY_ORDER, CATEGORY_STYLES };
