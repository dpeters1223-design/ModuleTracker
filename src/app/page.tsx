import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ModuleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHANGE_ORDER_STATUS_LABELS, CLOSED_CHANGE_ORDER_STATUSES, MODULE_STATUS_LABELS, TASK_PHASE_LABELS } from "@/lib/labels";
import { statusPillStyle } from "@/lib/phase-colors";
import { moduleTitle } from "@/lib/script-template";
import { formatDay } from "@/lib/task-format";
import { todayInZone } from "@/lib/dates";
import { dayLabel, getActivity } from "@/lib/activity-feed";
import { PhaseDot } from "@/components/phase-dot";
import { ActivityList } from "@/components/activity-list";

export const metadata: Metadata = { title: "Dashboard · ModuleTracker" };

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const noon = (d: string) => new Date(`${d}T12:00:00Z`);

function Card({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, href, alert = false }: { label: string; value: number; href: string; alert?: boolean }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <p className={`text-3xl font-semibold tabular-nums ${alert && value ? "text-red-700 dark:text-red-400" : ""}`}>
        {value}
      </p>
      <p className="text-sm text-zinc-500">{label}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  await connection();
  const today = todayInZone();
  const weekStart = addDays(today, -((noon(today).getUTCDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);

  const [modules, openTasks, openChangeOrders, activity] = await Promise.all([
    prisma.module.findMany({ select: { id: true, number: true, name: true, status: true }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({
      where: { status: { not: "completed" } },
      include: { module: { select: { id: true, number: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { order: "asc" }],
    }),
    prisma.changeOrder.findMany({
      where: { status: { notIn: CLOSED_CHANGE_ORDER_STATUSES } },
      include: { module: { select: { number: true, name: true } } },
      orderBy: [{ goalDate: { sort: "asc", nulls: "last" } }, { suggestedDate: "desc" }],
    }),
    getActivity({}, 8),
  ]);

  if (!modules.length) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No modules yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            <Link href="/discovery/new" className="underline underline-offset-4">
              Start one with the Discovery Form
            </Link>{" "}
            and this page will fill in with what&apos;s due, what&apos;s late and where each module stands.
          </p>
        </div>
      </main>
    );
  }

  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const overdue = openTasks.filter((t) => t.dueDate && day(t.dueDate) < today);
  const thisWeek = openTasks.filter((t) => t.dueDate && day(t.dueDate) >= today && day(t.dueDate) <= weekEnd);
  const inProgress = modules.filter((m) => !["on_hold", "not_started", "deployed"].includes(m.status));
  const stages = (Object.keys(MODULE_STATUS_LABELS) as ModuleStatus[])
    .map((s) => ({ s, mods: modules.filter((m) => m.status === s) }))
    .filter((x) => x.mods.length);
  const dayLabels = Object.fromEntries([...new Set(activity.map((a) => a.day))].map((d) => [d, dayLabel(d)]));

  const taskList = (items: typeof openTasks, empty: string, late = false) =>
    items.length ? (
      <ul className="space-y-2">
        {items.slice(0, 6).map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.title}</p>
              <p className="flex items-center gap-1 text-xs text-zinc-500">
                <PhaseDot phase={t.phase} />
                <Link href={`/modules/${t.module.id}`} className="truncate hover:underline">
                  {moduleTitle(t.module)}
                </Link>
                <span>· {TASK_PHASE_LABELS[t.phase]}</span>
                {t.owner && <span>· {t.owner}</span>}
              </p>
            </div>
            <span className={`shrink-0 text-xs ${late ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-500"}`}>
              {formatDay(day(t.dueDate), today)}
            </span>
          </li>
        ))}
        {items.length > 6 && <li className="text-xs text-zinc-500">…and {items.length - 6} more</li>}
      </ul>
    ) : (
      <p className="text-sm text-zinc-500">{empty}</p>
    );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Open tasks" value={openTasks.length} href="/tasks" />
        <Stat label="Overdue" value={overdue.length} href="/tasks?due=overdue" alert />
        <Stat label="Due this week" value={thisWeek.length} href="/tasks?due=week" />
        <Stat label="Modules in progress" value={inProgress.length} href="/modules" />
        <Stat label="Open change orders" value={openChangeOrders.length} href="/changes" />
      </div>

      <Card title="Modules by stage" href="/modules?view=board">
        <div className="flex flex-wrap gap-3">
          {stages.map(({ s, mods }) => (
            <div key={s} className="min-w-44 flex-1 space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-800"
                  style={statusPillStyle(s)}
                >
                  {MODULE_STATUS_LABELS[s]}
                </span>
                <span className="text-zinc-500">{mods.length}</span>
              </p>
              <ul className="space-y-0.5 text-sm">
                {mods.map((m) => (
                  <li key={m.id} className="truncate">
                    <Link href={`/modules/${m.id}`} className="hover:underline">
                      {moduleTitle(m)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Overdue (${overdue.length})`} href="/tasks?due=overdue">
          {taskList(overdue, "Nothing overdue.", true)}
        </Card>
        <Card title={`Due this week (${thisWeek.length})`} href="/tasks?due=week">
          {taskList(thisWeek, "Nothing else due this week.")}
        </Card>
        <Card title={`Open change orders (${openChangeOrders.length})`} href="/changes">
          {openChangeOrders.length ? (
            <ul className="space-y-2">
              {openChangeOrders.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.description}</p>
                    <p className="text-xs text-zinc-500">
                      {c.module ? moduleTitle(c.module) : "All modules"} · {CHANGE_ORDER_STATUS_LABELS[c.status]}
                    </p>
                  </div>
                  {c.goalDate && (
                    <span
                      className={`shrink-0 text-xs ${
                        day(c.goalDate) < today ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-500"
                      }`}
                    >
                      Goal {formatDay(day(c.goalDate), today)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No open change orders.</p>
          )}
        </Card>
        <Card title="Recent activity" href="/activity">
          <ActivityList items={activity} dayLabels={dayLabels} />
        </Card>
      </div>
    </main>
  );
}
