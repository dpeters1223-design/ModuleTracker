"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { markNotificationsSeen, undoChange } from "@/app/activity/actions";
import type { ActivityItem } from "@/lib/activity-feed";

function UndoButton({ item }: { item: ActivityItem }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      onClick={() => {
        if (!confirm(`Undo this change?\n\n${item.summary}`)) return;
        startTransition(async () => {
          const res = await undoChange(item.id);
          if (res.error) alert(`Couldn't undo: ${res.error}`);
        });
      }}
    >
      {pending ? "Undoing…" : "Undo"}
    </button>
  );
}

/**
 * History entries grouped by day (labels computed on the server). `showModule`
 * adds the module name to each entry (for the all-activity view).
 */
export function ActivityList({
  items,
  dayLabels,
  showModule = true,
}: {
  items: ActivityItem[];
  dayLabels: Record<string, string>;
  showModule?: boolean;
}) {
  if (!items.length) return <p className="text-sm text-zinc-500">No changes recorded yet.</p>;
  const days = [...new Set(items.map((i) => i.day))];
  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day} className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{dayLabels[day]}</h3>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {items
              .filter((i) => i.day === day)
              .map((i) => (
                <li key={i.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <span className="w-16 shrink-0 pt-px text-xs text-zinc-500">{i.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className={i.undoneBy ? "text-zinc-400 line-through" : ""}>
                      <span className="font-medium">{i.actor}</span> {i.summary}
                    </p>
                    {(showModule && i.moduleLabel) || i.undoneBy ? (
                      <p className="text-xs text-zinc-500">
                        {showModule &&
                          i.moduleLabel &&
                          (i.moduleExists ? (
                            <Link href={`/modules/${i.moduleId}`} className="underline decoration-zinc-300 underline-offset-2">
                              {i.moduleLabel}
                            </Link>
                          ) : (
                            <span>{i.moduleLabel} (deleted)</span>
                          ))}
                        {i.undoneBy && <span>{showModule && i.moduleLabel ? " · " : ""}Undone by {i.undoneBy}</span>}
                      </p>
                    ) : null}
                  </div>
                  {i.undoable && <UndoButton item={i} />}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Clears the viewer's notification bell once the notifications view has been shown. */
export function MarkNotificationsSeen() {
  useEffect(() => {
    markNotificationsSeen();
  }, []);
  return null;
}
