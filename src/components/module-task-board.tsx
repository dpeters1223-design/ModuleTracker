import Link from "next/link";
import type { Module, Task, TaskPhase } from "@prisma/client";
import { TASK_PHASE_LABELS } from "@/lib/labels";
import { formatDay } from "@/lib/task-format";
import { moduleTitle } from "@/lib/script-template";
import { ModuleStatusSelect } from "@/components/module-status-select";
import { TaskPhaseSelect, TaskStatusSelect } from "@/components/task-status";

const PHASES = Object.keys(TASK_PHASE_LABELS) as TaskPhase[];

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * One module's tasks as a board: a column per phase, a card per task. With
 * `showHeader`, the board is labeled with the module (for the all-modules view).
 */
export function ModuleTaskBoard({
  module: mod,
  tasks,
  today,
  showHeader = false,
}: {
  module: Pick<Module, "id" | "number" | "name" | "status">;
  tasks: Task[];
  today: string;
  showHeader?: boolean;
}) {
  const done = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status !== "completed" && t.dueDate && day(t.dueDate) < today).length;

  return (
    <section className="space-y-2">
      {showHeader && (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">
            <Link href={`/modules/${mod.id}`} className="hover:underline">
              {moduleTitle(mod)}
            </Link>
          </h2>
          <ModuleStatusSelect moduleId={mod.id} status={mod.status} />
          <span className="text-sm text-zinc-500">
            {tasks.length ? `${done} of ${tasks.length} tasks done` : "No tasks yet"}
            {overdue > 0 && <span className="font-medium text-red-700 dark:text-red-400"> · {overdue} overdue</span>}
          </span>
        </header>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {PHASES.map((phase) => {
          const column = tasks.filter((t) => t.phase === phase);
          return (
            <div key={phase} className="flex w-52 shrink-0 flex-col rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
              <h3 className="flex items-baseline justify-between px-1 pb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {TASK_PHASE_LABELS[phase]}
                <span className="font-normal text-zinc-500">{column.length || ""}</span>
              </h3>
              <ul className="space-y-2">
                {column.map((t) => {
                  const due = day(t.dueDate);
                  const late = t.status !== "completed" && !!due && due < today;
                  return (
                    <li
                      key={t.id}
                      className="space-y-1.5 rounded-md border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <p
                        className={`text-sm ${
                          t.status === "completed" ? "text-zinc-400 line-through" : "font-medium"
                        }`}
                      >
                        {t.title}
                      </p>
                      {(t.owner || due) && (
                        <p className="text-xs text-zinc-500">
                          {[t.owner, due && `Due ${formatDay(due, today)}`].filter(Boolean).join(" · ")}
                          {late && <span className="ml-1 font-medium text-red-700 dark:text-red-400">Overdue</span>}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TaskStatusSelect moduleId={t.moduleId} taskId={t.id} title={t.title} status={t.status} />
                        <TaskPhaseSelect moduleId={t.moduleId} taskId={t.id} title={t.title} phase={t.phase} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
