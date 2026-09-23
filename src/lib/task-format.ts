// Plain task display helpers, usable from both Server and Client Components.
import { TASK_STATUS_LABELS } from "@/lib/labels";

export const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS) as (keyof typeof TASK_STATUS_LABELS)[];

export const TASK_STATUS_STYLES: Record<string, string> = {
  not_started: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  delayed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

/** "2026-09-03" → "Sep 3" (or "Sep 3, 2027" outside today's year). Fixed locale so server and browser agree. */
export function formatDay(d: string, today: string) {
  const sameYear = d.slice(0, 4) === today.slice(0, 4);
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
