"use server";

import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { appUrl } from "@/lib/slack";
import { notifyMentions, parseMentions } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type CommentResult = { errors?: string[] };

async function findTask(moduleId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, moduleId }, select: { id: true, title: true } });
}

/** Adds a comment and Slack-pings anyone it @mentions. */
export async function addTaskComment(moduleId: string, taskId: string, body: string): Promise<CommentResult> {
  const user = await requireUser();
  const task = await findTask(moduleId, taskId);
  if (!task) return { errors: ["That task no longer exists."] };

  const text = body.trim();
  if (!text) return { errors: ["Write something first."] };
  if (text.length > 10_000) return { errors: ["That comment is too long."] };

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const comment = await prisma.taskComment.create({
    data: { taskId, authorId: user.id, authorName: me?.name ?? user.email, body: text },
  });

  await logActivity(user, {
    action: "taskComment.add",
    summary: `Commented on "${task.title}"`,
    entityType: "taskComment",
    entityId: comment.id,
    moduleId,
    after: comment,
  });
  changed();

  const mentioned = await parseMentions(text);
  notifyMentions(mentioned, { id: user.id, name: me?.name ?? user.email }, text, appUrl(`/modules/${moduleId}/tasks/${taskId}`));

  return {};
}

/** Lets someone correct their own comment. */
export async function updateTaskComment(moduleId: string, commentId: string, body: string): Promise<CommentResult> {
  const user = await requireUser();
  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, task: { moduleId } },
    include: { task: { select: { title: true } } },
  });
  if (!existing) return { errors: ["That comment no longer exists."] };
  if (existing.authorId !== user.id) return { errors: ["Only the person who wrote it can edit it."] };

  const text = body.trim();
  if (!text) return { errors: ["Write something first."] };
  if (text.length > 10_000) return { errors: ["That comment is too long."] };

  const { task, ...before } = existing;
  const after = await prisma.taskComment.update({ where: { id: commentId }, data: { body: text } });
  await logActivity(user, {
    action: "taskComment.edit",
    summary: `Edited a comment on "${task.title}"`,
    entityType: "taskComment",
    entityId: commentId,
    moduleId,
    before,
    after,
  });
  changed();
  return {};
}

/** Lets someone delete their own comment. */
export async function deleteTaskComment(moduleId: string, commentId: string): Promise<CommentResult> {
  const user = await requireUser();
  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, task: { moduleId } },
    include: { task: { select: { title: true } } },
  });
  if (!existing) return {};
  if (existing.authorId !== user.id) return { errors: ["Only the person who wrote it can delete it."] };

  const { task, ...before } = existing;
  await prisma.taskComment.delete({ where: { id: commentId } });
  await logActivity(user, {
    action: "taskComment.remove",
    summary: `Deleted a comment on "${task.title}"`,
    entityType: "taskComment",
    entityId: commentId,
    moduleId,
    before,
  });
  changed();
  return {};
}
