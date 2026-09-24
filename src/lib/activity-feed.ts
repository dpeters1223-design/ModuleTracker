import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailList, undoKind } from "@/lib/activity";
import { dayInZone, timeInZone, todayInZone } from "@/lib/dates";

export type ActivityItem = {
  id: string;
  day: string; // "YYYY-MM-DD" in the app's time zone
  time: string; // e.g. "2:14 PM"
  actor: string;
  summary: string;
  moduleId: string | null;
  moduleLabel: string | null;
  moduleExists: boolean;
  undoable: boolean;
  undoneBy: string | null;
};

/** Recent history, newest first, ready to render. */
export async function getActivity(where: Prisma.ActivityLogWhereInput = {}, take = 200): Promise<ActivityItem[]> {
  const rows = await prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, take });
  const ids = [...new Set(rows.map((r) => r.moduleId).filter(Boolean))] as string[];
  const existing = new Set(
    (await prisma.module.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((m) => m.id)
  );
  return rows.map((r) => ({
    id: r.id,
    day: dayInZone(r.createdAt),
    time: timeInZone(r.createdAt),
    actor: r.actorName ?? r.actorEmail,
    summary: r.summary,
    moduleId: r.moduleId,
    moduleLabel: r.moduleLabel,
    moduleExists: !!r.moduleId && existing.has(r.moduleId),
    undoable: !r.undoneAt && undoKind(r.action) !== "none",
    undoneBy: r.undoneBy,
  }));
}

/** "Today", "Yesterday", or e.g. "Wed, Sep 24" for a "YYYY-MM-DD" day. */
export function dayLabel(day: string): string {
  const today = todayInZone();
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

// Notifications: people in NOTIFY_USERS get a bell counting new changes made by
// anyone in NOTIFY_ABOUT (e.g. David and Jay, about Tom's updates). In-app only.
export const notifyUsers = () => emailList(process.env.NOTIFY_USERS);
export const watchedPeople = () => emailList(process.env.NOTIFY_ABOUT);

export async function unreadNotifications(email: string): Promise<number> {
  if (!notifyUsers().includes(email.toLowerCase()) || !watchedPeople().length) return 0;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { lastSeenActivityAt: true } });
  return prisma.activityLog.count({
    where: {
      actorEmail: { in: watchedPeople() },
      ...(user?.lastSeenActivityAt ? { createdAt: { gt: user.lastSeenActivityAt } } : {}),
    },
  });
}
