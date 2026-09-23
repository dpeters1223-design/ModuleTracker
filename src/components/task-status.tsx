"use client";

import { useTransition } from "react";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { setTaskStatus } from "@/app/modules/[id]/task-actions";
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
