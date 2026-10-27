"use server";

import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type FeedbackResult = { errors?: string[] };

/** The task, confirmed to belong to this module. */
async function findTask(moduleId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, moduleId },
    select: { id: true, title: true, isPlaythrough: true },
  });
}

/** Turns a task into a playthrough (or back), which is what gives it a feedback tab. */
export async function setTaskPlaythrough(
  moduleId: string,
  taskId: string,
  isPlaythrough: boolean
): Promise<FeedbackResult> {
  const user = await requireUser();
  const task = await findTask(moduleId, taskId);
  if (!task) return { errors: ["That task no longer exists."] };
  if (task.isPlaythrough === isPlaythrough) return {};

  if (!isPlaythrough) {
    const written = await prisma.playthroughFeedback.count({ where: { taskId } });
    if (written) {
      return { errors: ["That playthrough has feedback on it, so it can't be turned back into a plain task."] };
    }
  }

  await prisma.task.update({ where: { id: taskId }, data: { isPlaythrough } });
  await logActivity(user, {
    action: "task.playthrough",
    summary: isPlaythrough
      ? `Marked "${task.title}" as a playthrough`
      : `"${task.title}" is no longer a playthrough`,
    entityType: "task",
    entityId: taskId,
    moduleId,
    before: { isPlaythrough: task.isPlaythrough },
    after: { isPlaythrough },
  });
  changed();
  return {};
}

/**
 * Saves a playthrough write-up. These are long — a transcript of what somebody saw
 * and said while going through the module — so the only limit is a sanity cap.
 */
export async function submitPlaythroughFeedback(
  moduleId: string,
  taskId: string,
  body: string
): Promise<FeedbackResult> {
  const user = await requireUser();
  const task = await findTask(moduleId, taskId);
  if (!task) return { errors: ["That task no longer exists."] };
  if (!task.isPlaythrough) return { errors: ["That task isn't a playthrough."] };

  const text = body.trim();
  if (!text) return { errors: ["Write something first."] };
  if (text.length > 200_000) return { errors: ["That write-up is too long to save."] };

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const feedback = await prisma.playthroughFeedback.create({
    data: { taskId, authorId: user.id, authorName: me?.name ?? user.email, body: text },
  });

  await logActivity(user, {
    action: "playthroughFeedback.add",
    summary: `Submitted playthrough feedback on "${task.title}"`,
    entityType: "playthroughFeedback",
    entityId: feedback.id,
    moduleId,
    after: feedback,
  });
  changed();
  return {};
}

/** Lets someone correct their own write-up — a transcript is easy to paste wrong. */
export async function updatePlaythroughFeedback(
  moduleId: string,
  feedbackId: string,
  body: string
): Promise<FeedbackResult> {
  const user = await requireUser();
  const existing = await prisma.playthroughFeedback.findFirst({
    where: { id: feedbackId, task: { moduleId } },
    include: { task: { select: { title: true } } },
  });
  if (!existing) return { errors: ["That write-up no longer exists."] };
  if (existing.authorId !== user.id) return { errors: ["Only the person who wrote it can edit it."] };

  const text = body.trim();
  if (!text) return { errors: ["Write something first."] };
  if (text.length > 200_000) return { errors: ["That write-up is too long to save."] };

  const { task, ...before } = existing;
  const after = await prisma.playthroughFeedback.update({ where: { id: feedbackId }, data: { body: text } });
  await logActivity(user, {
    action: "playthroughFeedback.edit",
    summary: `Edited playthrough feedback on "${task.title}"`,
    entityType: "playthroughFeedback",
    entityId: feedbackId,
    moduleId,
    before,
    after,
  });
  changed();
  return {};
}
