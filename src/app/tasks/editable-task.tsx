"use client";

import { useState } from "react";
import { TaskForm } from "@/app/modules/[id]/task-list";
import { updateTask, type TaskInput } from "@/app/modules/[id]/task-actions";

/**
 * A row on the Tasks / My tasks page with an Edit button that swaps the row for the
 * task form in place. `children` is the row's normal (server-rendered) content.
 */
export function EditableTask({
  moduleId,
  taskId,
  initial,
  owners,
  subtask,
  className,
  children,
}: {
  moduleId: string;
  taskId: string;
  initial: TaskInput;
  owners: string[];
  /** Sub-tasks have no phase picker (they share their parent's phase). */
  subtask: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="p-2">
        <TaskForm
          initial={initial}
          owners={owners}
          submitLabel="Save"
          subtask={subtask}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const res = await updateTask(moduleId, taskId, input);
            if (!res.errors?.length) setEditing(false);
            return res;
          }}
        />
      </li>
    );
  }
  return (
    <li className={className}>
      {children}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Edit
      </button>
    </li>
  );
}
