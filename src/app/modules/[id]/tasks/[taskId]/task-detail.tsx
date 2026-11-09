"use client";

import { useState } from "react";
import Link from "next/link";
import { TaskForm, type TaskRow } from "../../task-list";
import { updateTask } from "../../task-actions";
import { TaskStatusSelect } from "@/components/task-status";
import { PhaseDot } from "@/components/phase-dot";
import { AttachImagePanel, TaskImages } from "@/components/task-images";
import { PlaythroughFeedback, type FeedbackRow } from "../../playthrough-feedback";
import { TaskComments, type CommentRow } from "../../task-comments";
import type { TaskPhase } from "@prisma/client";
import { TASK_PHASE_LABELS } from "@/lib/labels";
import { formatDay } from "@/lib/task-format";

const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";

export type SubtaskRow = { id: string; title: string; status: string; dueDate: string };

/** One task, full detail: editable fields, attachments, feedback and comments. */
export function TaskDetail({
  moduleId,
  moduleLabel,
  task,
  owners,
  today,
  parent,
  subtasks,
  feedback,
  comments,
  names,
}: {
  moduleId: string;
  moduleLabel: string;
  task: TaskRow & { id: string };
  owners: string[];
  today: string;
  parent: { id: string; title: string } | null;
  subtasks: SubtaskRow[];
  feedback: FeedbackRow[];
  comments: CommentRow[];
  names: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const isOverdue = task.status !== "completed" && !!task.dueDate && task.dueDate < today;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <Link href={`/modules/${moduleId}`} className={linkBtn}>
          ← {moduleLabel}
        </Link>
        {parent && (
          <p className="text-sm text-zinc-500">
            ↳ Sub-task of{" "}
            <Link href={`/modules/${moduleId}/tasks/${parent.id}`} className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
              {parent.title}
            </Link>
          </p>
        )}
      </div>

      {editing ? (
        <TaskForm
          initial={task}
          owners={owners}
          submitLabel="Save"
          subtask={!!task.parentId}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const res = await updateTask(moduleId, task.id, input);
            if (!res.errors?.length) setEditing(false);
            return res;
          }}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className={`text-xl font-semibold ${task.status === "completed" ? "text-zinc-400 line-through" : ""}`}>
              {task.title}
            </h1>
            <button type="button" className={linkBtn} onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <TaskStatusSelect moduleId={moduleId} taskId={task.id} title={task.title} status={task.status} />
            {!task.parentId && (
              <span className="inline-flex items-center gap-1.5">
                <PhaseDot phase={task.phase as TaskPhase} />
                {TASK_PHASE_LABELS[task.phase as TaskPhase]}
              </span>
            )}
            {task.owner && <span>{task.owner}</span>}
            {(task.startDate || task.dueDate) && (
              <span className={isOverdue ? "font-medium text-red-700 dark:text-red-400" : ""}>
                {task.startDate && task.dueDate
                  ? `${formatDay(task.startDate, today)} → ${formatDay(task.dueDate, today)}`
                  : task.dueDate
                    ? `Due ${formatDay(task.dueDate, today)}`
                    : `Starts ${formatDay(task.startDate, today)}`}
                {isOverdue && " · Overdue"}
              </span>
            )}
          </div>
          {task.notes && <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{task.notes}</p>}

          {subtasks.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-500">
                Sub-tasks · {subtasks.filter((s) => s.status === "completed").length} of {subtasks.length} done
              </p>
              <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-300 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-950">
                {subtasks.map((s) => (
                  <li key={s.id} className="px-3 py-2">
                    <Link
                      href={`/modules/${moduleId}/tasks/${s.id}`}
                      className={`hover:underline ${s.status === "completed" ? "text-zinc-400 line-through" : ""}`}
                    >
                      {s.title}
                    </Link>
                    {s.dueDate && <span className="ml-2 text-xs text-zinc-500">Due {formatDay(s.dueDate, today)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <TaskImages moduleId={moduleId} images={task.images} size="h-24 w-24" />
            {attaching ? (
              <AttachImagePanel moduleId={moduleId} taskId={task.id} onDone={() => setAttaching(false)} />
            ) : (
              <button type="button" className={`mt-2 ${linkBtn}`} onClick={() => setAttaching(true)}>
                + Attach file
              </button>
            )}
          </div>

          {task.isPlaythrough && (
            <PlaythroughFeedback moduleId={moduleId} taskId={task.id} taskTitle={task.title} entries={feedback} />
          )}
        </div>
      )}

      <hr className="border-zinc-200 dark:border-zinc-800" />
      <TaskComments moduleId={moduleId} taskId={task.id} entries={comments} names={names} />
    </main>
  );
}
