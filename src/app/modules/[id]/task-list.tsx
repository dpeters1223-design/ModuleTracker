"use client";

import { useState, useTransition } from "react";
import { TASK_PHASE_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { TaskStatusSelect } from "@/components/task-status";
import { PhaseDot } from "@/components/phase-dot";
import { formatDay as fmt, TASK_STATUSES as STATUSES } from "@/lib/task-format";
import { createTask, deleteTask, updateTask, type TaskInput, type TaskResult } from "./task-actions";

export type TaskRow = TaskInput & { id: string; parentId: string | null };

const PHASES = Object.keys(TASK_PHASE_LABELS) as (keyof typeof TASK_PHASE_LABELS)[];

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";

const isOverdue = (t: TaskRow, today: string) =>
  t.status !== "completed" && !!t.dueDate && t.dueDate < today;

function TaskForm({
  initial,
  owners,
  submitLabel,
  onSubmit,
  onCancel,
  subtask = false,
}: {
  initial: TaskInput;
  owners: string[];
  submitLabel: string;
  onSubmit: (input: TaskInput) => Promise<TaskResult>;
  onCancel: () => void;
  /** Sub-tasks have no phase picker: they always share their parent's phase. */
  subtask?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof TaskInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
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
        placeholder={subtask ? "Sub-task, e.g. Export the scene 2 media" : "Task, e.g. Film scenes 1–4"}
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        autoFocus
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {!subtask && (
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
        )}
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

/** One task's line: status, title, owner and dates, notes, and its actions. */
function TaskLine({
  moduleId,
  task,
  today,
  waitingOn,
  pending,
  onEdit,
  onAddSubtask,
  onDelete,
}: {
  moduleId: string;
  task: TaskRow;
  today: string;
  /** The first unfinished sub-task, shown as "Waiting on …" on its parent. */
  waitingOn?: TaskRow;
  pending: boolean;
  onEdit: () => void;
  onAddSubtask?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <TaskStatusSelect moduleId={moduleId} taskId={task.id} title={task.title} status={task.status} />
      <div className="order-last min-w-0 flex-1 basis-full sm:order-none sm:basis-0">
        <p className={`text-sm ${task.status === "completed" ? "text-zinc-400 line-through" : "font-medium"}`}>
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
            <span className="ml-1 font-medium text-red-700 dark:text-red-400">Overdue</span>
          )}
        </p>
        {waitingOn && (
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            Waiting on {waitingOn.owner ? `${waitingOn.owner}: ` : ""}
            {waitingOn.title}
            {waitingOn.dueDate && ` (due ${fmt(waitingOn.dueDate, today)})`}
          </p>
        )}
        {task.notes && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{task.notes}</p>
        )}
      </div>
      <div className="ml-auto flex gap-3 sm:ml-0">
        {onAddSubtask && (
          <button type="button" className={linkBtn} onClick={onAddSubtask}>
            + Sub-task
          </button>
        )}
        <button type="button" className={linkBtn} onClick={onEdit}>
          Edit
        </button>
        <button type="button" className={linkBtn} disabled={pending} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
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
  // The task whose "+ Sub-task" form is open.
  const [subFor, setSubFor] = useState<string | null>(null);
  const [lastPhase, setLastPhase] = useState<string>("pre_production");
  const [pending, startTransition] = useTransition();
  const isDone = (t: TaskRow) => t.status === "completed";
  // Phases folded away, and phases showing their completed tasks (hidden by default).
  // Phases where everything is done start folded.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(PHASES.filter((p) => tasks.some((t) => t.phase === p) && tasks.every((t) => t.phase !== p || isDone(t))))
  );
  const [showDone, setShowDone] = useState<Set<string>>(() => new Set());
  const toggle = (set: Set<string>, update: (s: Set<string>) => void, phase: string) => {
    const next = new Set(set);
    if (next.has(phase)) next.delete(phase);
    else next.add(phase);
    update(next);
  };

  const done = tasks.filter(isDone).length;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const subtasksOf = (id: string) => tasks.filter((t) => t.parentId === id);
  // Top-level tasks (and any sub-task whose parent isn't in this list) are grouped by phase.
  const ids = new Set(tasks.map((t) => t.id));
  const topLevel = tasks.filter((t) => !t.parentId || !ids.has(t.parentId));
  const byPhase = addOnly
    ? []
    : PHASES.map((phase) => ({
        phase,
        tasks: topLevel.filter((t) => t.phase === phase),
      })).filter((g) => g.tasks.length);
  const allCollapsed = byPhase.length > 0 && byPhase.every((g) => collapsed.has(g.phase));

  const blank: TaskInput = {
    title: "",
    phase: lastPhase,
    owner: "",
    status: "not_started",
    startDate: "",
    dueDate: "",
    notes: "",
  };
  // Only one form open at a time: adding a task, editing one, or adding a sub-task.
  const openOnly = (which: "add" | "edit" | "sub", id: string | null = null) => {
    setAdding(which === "add");
    setEditingId(which === "edit" ? id : null);
    setSubFor(which === "sub" ? id : null);
  };
  const remove = (task: TaskRow) => {
    const n = subtasksOf(task.id).length;
    const what = n ? `"${task.title}" and its ${n} sub-task${n === 1 ? "" : "s"}` : `"${task.title}"`;
    if (!confirm(`Delete ${what}?`)) return;
    startTransition(async () => {
      await deleteTask(moduleId, task.id);
    });
  };
  const editForm = (task: TaskRow) => (
    <TaskForm
      initial={task}
      owners={owners}
      submitLabel="Save"
      subtask={!!task.parentId}
      onCancel={() => setEditingId(null)}
      onSubmit={async (input) => {
        const res = await updateTask(moduleId, task.id, input);
        if (!res.errors?.length) setEditingId(null);
        return res;
      }}
    />
  );

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
        <div className="flex items-center gap-4">
          {byPhase.length > 1 && (
            <button
              type="button"
              className={linkBtn}
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(byPhase.map((g) => g.phase)))}
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
          {!adding && (
            <button type="button" className={secondaryBtn} onClick={() => openOnly("add")}>
              + Add task
            </button>
          )}
        </div>
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

      {byPhase.map(({ phase, tasks: group }) => {
        const all = group.flatMap((t) => [t, ...subtasksOf(t.id)]);
        const doneCount = all.filter(isDone).length;
        const isCollapsed = collapsed.has(phase);
        const showingDone = showDone.has(phase);
        // Completed tasks are hidden unless shown; a done task with open sub-tasks stays.
        const visible = showingDone
          ? group
          : group.filter((t) => !isDone(t) || subtasksOf(t.id).some((s) => !isDone(s)));
        const visibleSubs = (id: string) => subtasksOf(id).filter((s) => showingDone || !isDone(s));
        const hiddenCount = all.length - visible.reduce((n, t) => n + 1 + visibleSubs(t.id).length, 0);
        const toggleDoneBtn = "underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100";
        return (
          <section key={phase} className="space-y-2">
            <h3>
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(collapsed, setCollapsed, phase)}
                className="flex w-full items-center gap-2 rounded text-left text-sm font-semibold hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg
                  viewBox="0 0 16 16"
                  className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M6 3.5 10.5 8 6 12.5z" />
                </svg>
                <PhaseDot phase={phase} />
                {TASK_PHASE_LABELS[phase]}
                <span className="text-xs font-normal text-zinc-500">
                  {doneCount}/{all.length}
                  {isCollapsed && ` · ${all.length - doneCount} open`}
                </span>
              </button>
            </h3>
            {!isCollapsed && visible.length === 0 && (
              <p className="pl-5 text-xs text-zinc-500">
                All {doneCount} done.{" "}
                <button type="button" className={toggleDoneBtn} onClick={() => toggle(showDone, setShowDone, phase)}>
                  Show completed
                </button>
              </p>
            )}
            {!isCollapsed && visible.length > 0 && (
            <ul className="divide-y divide-zinc-300 rounded-lg border border-zinc-300 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-950">
              {visible.map((task) => {
                const subs = subtasksOf(task.id);
                const shownSubs = visibleSubs(task.id);
                const waitingOn =
                  task.status !== "completed"
                    ? subs
                        .filter((s) => s.status !== "completed")
                        .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))[0]
                    : undefined;
                return (
                  <li key={task.id} className="px-3 py-2.5">
                    {editingId === task.id ? (
                      editForm(task)
                    ) : (
                      <TaskLine
                        moduleId={moduleId}
                        task={task}
                        today={today}
                        waitingOn={waitingOn}
                        pending={pending}
                        onEdit={() => openOnly("edit", task.id)}
                        onAddSubtask={task.parentId ? undefined : () => openOnly("sub", task.id)}
                        onDelete={() => remove(task)}
                      />
                    )}
                    {(subs.length > 0 || subFor === task.id) && (
                      <div className="mt-2 ml-3 space-y-2 border-l-2 border-zinc-300 pl-3 sm:ml-8 dark:border-zinc-600">
                        {subs.length > 0 && (
                          <p className="text-xs font-medium text-zinc-500">
                            Sub-tasks · {subs.filter((s) => s.status === "completed").length} of {subs.length} done
                          </p>
                        )}
                        {shownSubs.length > 0 && (
                          <ul className="space-y-2">
                            {shownSubs.map((sub) => (
                              <li key={sub.id}>
                                {editingId === sub.id ? (
                                  editForm(sub)
                                ) : (
                                  <TaskLine
                                    moduleId={moduleId}
                                    task={sub}
                                    today={today}
                                    pending={pending}
                                    onEdit={() => openOnly("edit", sub.id)}
                                    onDelete={() => remove(sub)}
                                  />
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {subFor === task.id && (
                          <TaskForm
                            initial={{ ...blank, phase: task.phase }}
                            owners={owners}
                            submitLabel="Add sub-task"
                            subtask
                            onCancel={() => setSubFor(null)}
                            onSubmit={async (input) => {
                              const res = await createTask(moduleId, input, task.id);
                              if (!res.errors?.length) setSubFor(null);
                              return res;
                            }}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
            {!isCollapsed && visible.length > 0 && doneCount > 0 && (hiddenCount > 0 || showingDone) && (
              <button
                type="button"
                className={`pl-5 text-xs text-zinc-500 ${toggleDoneBtn}`}
                onClick={() => toggle(showDone, setShowDone, phase)}
              >
                {showingDone ? "Hide completed" : `Show ${hiddenCount} completed`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
