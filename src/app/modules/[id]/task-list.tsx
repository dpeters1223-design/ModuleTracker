"use client";

import { useState, useTransition } from "react";
import { TASK_PHASE_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { TaskStatusSelect } from "@/components/task-status";
import { PhaseDot } from "@/components/phase-dot";
import { formatDay as fmt, TASK_STATUSES as STATUSES } from "@/lib/task-format";
import { createTask, deleteTask, updateTask, type TaskInput, type TaskResult } from "./task-actions";

export type TaskRow = TaskInput & { id: string };

const PHASES = Object.keys(TASK_PHASE_LABELS) as (keyof typeof TASK_PHASE_LABELS)[];

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";

const isOverdue = (t: TaskRow, today: string) =>
  t.status !== "completed" && !!t.dueDate && t.dueDate < today;

function TaskForm({
  initial,
  owners,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: TaskInput;
  owners: string[];
  submitLabel: string;
  onSubmit: (input: TaskInput) => Promise<TaskResult>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof TaskInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await onSubmit(form);
          if (res.errors?.length) setErrors(res.errors);
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
      <input
        className={inputCls}
        placeholder="Task, e.g. Film scenes 1–4"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        autoFocus
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-zinc-500">
          Phase
          <select className={inputCls} value={form.phase} onChange={(e) => set("phase", e.target.value)}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {TASK_PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Owner
          <input
            className={inputCls}
            list="task-owner-options"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Status
          <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Start
          <input
            type="date"
            className={inputCls}
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Due
          <input
            type="date"
            className={inputCls}
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </label>
      </div>
      <textarea
        className={`${inputCls} min-h-16`}
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
      />
      <datalist id="task-owner-options">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <button type="submit" className={primaryBtn} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button type="button" className={secondaryBtn} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** With `addOnly`, shows just the summary line and "Add task" (the board view renders the tasks). */
export function TaskList({
  moduleId,
  tasks,
  owners,
  today,
  addOnly = false,
}: {
  moduleId: string;
  tasks: TaskRow[];
  owners: string[];
  today: string;
  addOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastPhase, setLastPhase] = useState<string>("pre_production");
  const [pending, startTransition] = useTransition();

  const done = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const byPhase = addOnly
    ? []
    : PHASES.map((phase) => ({
        phase,
        tasks: tasks.filter((t) => t.phase === phase),
      })).filter((g) => g.tasks.length);

  const blank: TaskInput = {
    title: "",
    phase: lastPhase,
    owner: "",
    status: "not_started",
    startDate: "",
    dueDate: "",
    notes: "",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {tasks.length === 0 ? (
            "No tasks yet."
          ) : (
            <>
              {done} of {tasks.length} done
              {overdue > 0 && (
                <span className="font-medium text-red-700 dark:text-red-400"> · {overdue} overdue</span>
              )}
            </>
          )}
        </p>
        {!adding && (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            + Add task
          </button>
        )}
      </div>

      {adding && (
        <TaskForm
          initial={blank}
          owners={owners}
          submitLabel="Add task"
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const res = await createTask(moduleId, input);
            if (!res.errors?.length) {
              setLastPhase(input.phase);
              setAdding(false);
            }
            return res;
          }}
        />
      )}

      {byPhase.map(({ phase, tasks: group }) => (
        <section key={phase} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PhaseDot phase={phase} />
            {TASK_PHASE_LABELS[phase]}
            <span className="text-xs font-normal text-zinc-500">
              {group.filter((t) => t.status === "completed").length}/{group.length}
            </span>
          </h3>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {group.map((task) =>
              editingId === task.id ? (
                <li key={task.id} className="p-2">
                  <TaskForm
                    initial={task}
                    owners={owners}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (input) => {
                      const res = await updateTask(moduleId, task.id, input);
                      if (!res.errors?.length) setEditingId(null);
                      return res;
                    }}
                  />
                </li>
              ) : (
                <li key={task.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                  <TaskStatusSelect
                    moduleId={moduleId}
                    taskId={task.id}
                    title={task.title}
                    status={task.status}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        task.status === "completed" ? "text-zinc-400 line-through" : "font-medium"
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {[
                        task.owner,
                        task.startDate && task.dueDate
                          ? `${fmt(task.startDate, today)} → ${fmt(task.dueDate, today)}`
                          : task.dueDate
                            ? `Due ${fmt(task.dueDate, today)}`
                            : task.startDate
                              ? `Starts ${fmt(task.startDate, today)}`
                              : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {isOverdue(task, today) && (
                        <span className="ml-1 font-medium text-red-700 dark:text-red-400">
                          Overdue
                        </span>
                      )}
                    </p>
                    {task.notes && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                        {task.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => {
                        setAdding(false);
                        setEditingId(task.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={linkBtn}
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Delete "${task.title}"?`)) return;
                        startTransition(async () => {
                          await deleteTask(moduleId, task.id);
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
