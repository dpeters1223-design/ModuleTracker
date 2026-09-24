import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dayLabel, getActivity, notifyUsers, watchedPeople } from "@/lib/activity-feed";
import { ActivityList, MarkNotificationsSeen } from "@/components/activity-list";

export const metadata: Metadata = { title: "Activity · ModuleTracker" };

const selectCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function ActivityPage(props: PageProps<"/activity">) {
  await connection();
  const sp = await props.searchParams;
  const moduleId = typeof sp.module === "string" ? sp.module : "";
  const person = typeof sp.person === "string" ? sp.person : "";
  const watch = sp.watch === "1";

  const session = await auth();
  const viewer = session?.user?.email?.toLowerCase() ?? "";
  const isNotified = notifyUsers().includes(viewer);

  const where: Prisma.ActivityLogWhereInput = {
    AND: [
      moduleId ? { moduleId } : {},
      person ? { actorEmail: person } : {},
      watch ? { actorEmail: { in: watchedPeople() } } : {},
    ],
  };
  const [items, people, modules] = await Promise.all([
    getActivity(where),
    prisma.activityLog.findMany({
      distinct: ["actorEmail"],
      select: { actorEmail: true, actorName: true },
      orderBy: { actorEmail: "asc" },
    }),
    prisma.module.findMany({ select: { id: true, number: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const dayLabels = Object.fromEntries([...new Set(items.map((i) => i.day))].map((d) => [d, dayLabel(d)]));
  const watchedNames = people
    .filter((p) => watchedPeople().includes(p.actorEmail))
    .map((p) => p.actorName ?? p.actorEmail);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {watch && isNotified && <MarkNotificationsSeen />}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {watch
            ? `Updates by ${watchedNames.join(", ") || watchedPeople().join(", ")}`
            : "Every change made in the app. Undo reverses a change and records that it was undone."}
        </p>
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3 text-sm" method="get">
        <select name="module" defaultValue={moduleId} className={selectCls} aria-label="Module">
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.number ? `${m.number} – ${m.name}` : m.name}
            </option>
          ))}
        </select>
        <select name="person" defaultValue={person} className={selectCls} aria-label="Person">
          <option value="">Anyone</option>
          {people.map((p) => (
            <option key={p.actorEmail} value={p.actorEmail}>
              {p.actorName ?? p.actorEmail}
            </option>
          ))}
        </select>
        {watch && <input type="hidden" name="watch" value="1" />}
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Apply
        </button>
        {(moduleId || person || watch) && (
          <Link href="/activity" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Show everything
          </Link>
        )}
      </form>

      <ActivityList items={items} dayLabels={dayLabels} />
      {items.length === 200 && <p className="mt-4 text-xs text-zinc-500">Showing the latest 200 changes.</p>}
    </main>
  );
}
