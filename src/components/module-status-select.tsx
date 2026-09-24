"use client";

import { useTransition } from "react";
import { setModuleStatus } from "@/app/discovery/actions";
import { MODULE_STATUS_LABELS } from "@/lib/labels";

const STATUSES = Object.keys(MODULE_STATUS_LABELS) as (keyof typeof MODULE_STATUS_LABELS)[];

/** Module status pill that saves as soon as a new status is picked. */
export function ModuleStatusSelect({ moduleId, status }: { moduleId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Module status"
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${
        status === "on_hold"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : status === "deployed" || status === "signed_off"
            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      }`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const res = await setModuleStatus(moduleId, next);
          // Prerequisites not met: explain and let the user move it anyway.
          if (res.warning && confirm(`${res.warning}\n\nMove it anyway?`)) {
            await setModuleStatus(moduleId, next, true);
          }
        });
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {MODULE_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
