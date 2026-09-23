import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TASK_PHASE_LABELS } from "@/lib/labels";
import { moduleTitle } from "@/lib/script-template";
import { formatDay, TaskStatusSelect } from "@/components/task-status";

export const metadata: Metadata = { title: "Tasks · ModuleTracker" };

const selectCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function TasksPage(props: PageProps<"/tasks">) {
  await connection();
  const sp = await props.searchParams;
  const owner = typeof sp.owner === "string" ? sp.owner : "";
  const moduleId = typeof sp.module === "string" ? sp.module : "";
  const includeDone = sp.done === "1";

  const where: Prisma.TaskWhereInput = {
    ...(owner ? { owner } : {}),
    ...(moduleId ? { moduleId } : {}),
    ...(includeDone ? {} : { status: { not: "completed" } }),
  };

  const [tasks, modules, ownerRows] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { module: { select: { id: true, number: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { order: "asc" }],
    }),
    prisma.module.findMany({ select: { id: true, number: true, name: true }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({
      where: { owner: { not: null } },
      distinct: ["owner"],
      select: { owner: true },
      orderBy: { owner: "asc" },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const weekOut = addDays(today, 7);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const rows = tasks.map((t) => ({ ...t, due: day(t.dueDate), start: day(t.startDate) }));

  const open = (t: (typeof rows)[number]) => t.status !== "completed";
  const groups = [
    { key: "overdue", title: "Overdue", tone: "text-red-700 dark:text-red-400", items: rows.filter((t) => open(t) && t.due && t.due < today) },
    { key: "week", title: "Due in the next 7 days", tone: "", items: rows.filter((t) => open(t) && t.due && t.due >= today && t.due <= weekOut) },
    { key: "later", title: "Later", tone: "", items: rows.filter((t) => open(t) && t.due && t.due > weekOut) },
    { key: "none", title: "No due date", tone: "", items: rows.filter((t) => open(t) && !t.due) },
    { key: "done", title: "Done", tone: "", items: rows.filter((t) => !open(t)) },
  ].filter((g) => g.items.length);

  const openCount = rows.filter(open).length;
  const overdueCount = groups.find((g) => g.key === "overdue")?.items.length ?? 0;
  const filtered = Boolean(owner || moduleId);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {openCount} open task{openCount === 1 ? "" : "s"}
          {filtered && " matching the filters"}
          {overdueCount > 0 && (
            <span className="font-medium text-red-700 dark:text-red-400"> · {overdueCount} overdue</span>
          )}
        </p>
      </div>

      {/* Plain GET form: filters live in the URL, so a filtered view can be bookmarked or shared. */}
      <form className="mb-6 flex flex-wrap items-center gap-3 text-sm" method="get">
        <select name="owner" defaultValue={owner} className={selectCls} aria-label="Owner">
          <option value="">All owners</option>
          {ownerRows.map((o) => (
            <option key={o.owner} value={o.owner!}>
              {o.owner}
            </option>
          ))}
        </select>
        <select name="module" defaultValue={moduleId} className={selectCls} aria-label="Module">
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {moduleTitle(m)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" name="done" value="1" defaultChecked={includeDone} />
          Show done
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Apply
        </button>
        {(filtered || includeDone) && (
          <Link href="/tasks" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Clear
          </Link>
        )}
      </form>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">{filtered ? "No tasks match these filters" : "No open tasks"}</p>
          <p className="mt-1 text-sm text-zinc-500">Tasks are added on each module&apos;s page.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className={`text-sm font-semibold ${g.tone}`}>
                {g.title} <span className="font-normal text-zinc-500">({g.items.length})</span>
              </h2>
              <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                {g.items.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                    <TaskStatusSelect moduleId={t.moduleId} taskId={t.id} title={t.title} status={t.status} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${t.status === "completed" ? "text-zinc-400 line-through" : "font-medium"}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        <Link
                          href={`/modules/${t.module.id}`}
                          className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          {moduleTitle(t.module)}
                        </Link>
                        {" · "}
                        {TASK_PHASE_LABELS[t.phase]}
                        {t.owner && ` · ${t.owner}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${
                        g.key === "overdue" ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-500"
                      }`}
                    >
                      {t.due ? `Due ${formatDay(t.due, today)}` : t.start ? `Starts ${formatDay(t.start, today)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
