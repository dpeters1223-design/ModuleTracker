import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { todayInZone, dayInZone, timeInZone } from "@/lib/dates";
import { dayLabel } from "@/lib/activity-feed";
import { moduleTitle } from "@/lib/script-template";
import { teamNames } from "@/lib/team";
import { TaskDetail } from "./task-detail";

export async function generateMetadata(props: PageProps<"/modules/[id]/tasks/[taskId]">): Promise<Metadata> {
  const { taskId } = await props.params;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
  return { title: task ? `${task.title} · ModuleTracker` : "Task · ModuleTracker" };
}

export default async function TaskDetailPage(props: PageProps<"/modules/[id]/tasks/[taskId]">) {
  await connection();
  const { id: moduleId, taskId } = await props.params;
  const user = await requireUser();

  const record = await prisma.task.findFirst({
    where: { id: taskId, moduleId },
    include: {
      module: { select: { id: true, number: true, name: true } },
      parent: { select: { id: true, title: true } },
      subtasks: { select: { id: true, title: true, status: true, dueDate: true }, orderBy: { order: "asc" } },
      attachments: { select: { id: true, name: true, mimeType: true }, orderBy: { addedAt: "asc" } },
      feedback: {
        select: { id: true, authorId: true, authorName: true, body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        select: { id: true, authorId: true, authorName: true, body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!record) notFound();

  const ownerRows = await prisma.task.findMany({
    where: { owner: { not: null } },
    distinct: ["owner"],
    select: { owner: true },
  });
  const owners = [...new Set([...teamNames(), ...ownerRows.map((o) => o.owner!).filter(Boolean)])];
  const today = todayInZone();
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const when = (d: Date) => `${dayLabel(dayInZone(d))} at ${timeInZone(d)}`;

  return (
    <TaskDetail
      moduleId={moduleId}
      moduleLabel={moduleTitle(record.module)}
      task={{
        id: record.id,
        title: record.title,
        phase: record.phase,
        owner: record.owner ?? "",
        status: record.status,
        startDate: day(record.startDate),
        dueDate: day(record.dueDate),
        notes: record.notes ?? "",
        isPlaythrough: record.isPlaythrough,
        parentId: record.parentId,
        images: record.attachments,
        feedback: [],
      }}
      owners={owners}
      today={today}
      parent={record.parent}
      subtasks={record.subtasks.map((s) => ({ id: s.id, title: s.title, status: s.status, dueDate: day(s.dueDate) }))}
      feedback={record.feedback.map((f) => ({
        id: f.id,
        authorName: f.authorName,
        when: when(f.createdAt),
        body: f.body,
        mine: f.authorId === user.id,
      }))}
      comments={record.comments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        when: when(c.createdAt),
        body: c.body,
        mine: c.authorId === user.id,
      }))}
      names={teamNames()}
    />
  );
}
