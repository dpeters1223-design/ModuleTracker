import Link from "next/link";
import type { Module, Task } from "@prisma/client";
import { moduleTitle } from "@/lib/script-template";
import { ModuleStatusSelect } from "@/components/module-status-select";
import { TaskBoardColumns, type BoardTask } from "@/components/task-board-columns";

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
  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    moduleId: t.moduleId,
    title: t.title,
    phase: t.phase,
    status: t.status,
    owner: t.owner,
    due: day(t.dueDate),
  }));

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
      <TaskBoardColumns moduleId={mod.id} tasks={boardTasks} today={today} />
    </section>
  );
}
