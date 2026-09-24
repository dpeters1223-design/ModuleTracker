"use client";

import { useTransition } from "react";
import { setModuleStatus } from "@/app/discovery/actions";
import { MODULE_STATUS_LABELS } from "@/lib/labels";
import { statusPillStyle } from "@/lib/phase-colors";

const STATUSES = Object.keys(MODULE_STATUS_LABELS) as (keyof typeof MODULE_STATUS_LABELS)[];

/**
 * Module status pill, tinted with its phase color, that saves as soon as a new
 * status is picked (after a prerequisite warning, if one applies).
 */
export function ModuleStatusSelect({ moduleId, status }: { moduleId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Module status"
      className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      style={statusPillStyle(status)}
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
