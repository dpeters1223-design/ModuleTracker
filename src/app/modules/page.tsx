import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ModuleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODULE_STATUS_LABELS } from "@/lib/labels";
import { ModuleTaskBoard } from "@/components/module-task-board";

export const metadata: Metadata = { title: "Modules · ModuleTracker" };

// Module order for the board view: pipeline order, On hold last.
const PIPELINE = (Object.keys(MODULE_STATUS_LABELS) as ModuleStatus[]).filter((s) => s !== "on_hold");

export default async function ModulesPage(props: PageProps<"/modules">) {
  await connection();
  const { deleted, view } = await props.searchParams;
  const board = view === "board";

  const [modules, tasks, scripts] = await Promise.all([
    prisma.module.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { scenes: true } } },
    }),
    prisma.task.findMany({ orderBy: [{ dueDate: "asc" }, { order: "asc" }] }),
    prisma.documentLink.findMany({ where: { type: "script" }, select: { moduleId: true } }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const hasScript = new Set(scripts.map((s) => s.moduleId));
  const taskStats = new Map<string, { done: number; total: number; overdue: number }>();
  for (const t of tasks) {
    const s = taskStats.get(t.moduleId) ?? { done: 0, total: 0, overdue: 0 };
    s.total++;
    if (t.status === "completed") s.done++;
    else if (t.dueDate && t.dueDate.toISOString().slice(0, 10) < today) s.overdue++;
    taskStats.set(t.moduleId, s);
  }

  type Mod = (typeof modules)[number];
  const summary = (m: Mod) => {
    const s = taskStats.get(m.id);
    return (
      <>
        {s ? (
          <>
            {s.done}/{s.total} tasks
            {s.overdue > 0 && (
              <span className="font-medium text-red-700 dark:text-red-400"> · {s.overdue} overdue</span>
            )}
          </>
        ) : (
          "No tasks"
        )}
        {" · "}
        {m._count.scenes} scene{m._count.scenes === 1 ? "" : "s"}
        {" · "}
        {hasScript.has(m.id) ? "Script started" : "No script"}
      </>
    );
  };
  const title = (m: Mod) => (
    <>
      {m.number && <span className="text-zinc-500">{m.number} · </span>}
      {m.name}
    </>
  );

  const toggle = (active: boolean) =>
    `rounded-md px-3 py-1 text-sm font-medium ${
      active
        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    }`;

  return (
    <main className={`mx-auto w-full px-4 py-8 sm:px-6 ${board ? "max-w-none" : "max-w-4xl"}`}>
      <div className={board ? "mx-auto max-w-4xl" : ""}>
        {deleted && (
          <div
            role="status"
            className="mb-6 rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
          >
            Module deleted.
          </div>
        )}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {modules.length} module{modules.length === 1 ? "" : "s"}
            </p>
          </div>
          {modules.length > 0 && (
            <nav className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900" aria-label="View">
              <Link href="/modules" className={toggle(!board)} aria-current={!board ? "page" : undefined}>
                List
              </Link>
              <Link href="/modules?view=board" className={toggle(board)} aria-current={board ? "page" : undefined}>
                Board
              </Link>
            </nav>
          )}
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No modules yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            <Link href="/discovery/new" className="underline underline-offset-4">
              Start one with the Discovery Form
            </Link>
            . It captures the topic, learning objectives, tools and a scene-by-scene outline.
          </p>
        </div>
      ) : board ? (
        // One task board per module, active modules first and On hold last.
        <div className="space-y-10">
          {[...PIPELINE, "on_hold" as const].flatMap((status) =>
            modules
              .filter((m) => m.status === status)
              .map((m) => (
                <ModuleTaskBoard
                  key={m.id}
                  module={m}
                  tasks={tasks.filter((t) => t.moduleId === m.id)}
                  today={today}
                  showHeader
                />
              ))
          )}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {modules.map((m) => (
            <li key={m.id}>
              <Link
                href={`/modules/${m.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{title(m)}</p>
                  <p className="text-sm text-zinc-500">
                    {summary(m)}
                    {m.targetCompletion && ` · Target ${m.targetCompletion}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {MODULE_STATUS_LABELS[m.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
