"use client";

import { useTransition } from "react";
import { TASK_PHASE_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { setTaskPhase, setTaskStatus } from "@/app/modules/[id]/task-actions";
import { TASK_STATUSES, TASK_STATUS_STYLES } from "@/lib/task-format";

/** Colored status pill that changes the task's status as soon as a new one is picked. */
export function TaskStatusSelect({
  moduleId,
  taskId,
  title,
  status,
}: {
  moduleId: string;
  taskId: string;
  title: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Status of ${title}`}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${TASK_STATUS_STYLES[status]}`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await setTaskStatus(moduleId, taskId, next);
        });
      }}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

/** Small phase picker for board cards: picking a phase moves the card to that column. */
export function TaskPhaseSelect({
  moduleId,
  taskId,
  title,
  phase,
}: {
  moduleId: string;
  taskId: string;
  title: string;
  phase: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Move ${title} to phase`}
      title="Move to phase"
      className="max-w-full rounded border border-zinc-200 bg-transparent px-1 py-0.5 text-xs text-zinc-500 dark:border-zinc-700"
      value={phase}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await setTaskPhase(moduleId, taskId, next);
        });
      }}
    >
      {(Object.keys(TASK_PHASE_LABELS) as (keyof typeof TASK_PHASE_LABELS)[]).map((p) => (
        <option key={p} value={p}>
          → {TASK_PHASE_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
