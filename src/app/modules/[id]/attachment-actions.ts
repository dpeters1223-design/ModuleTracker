"use server";

import { changed } from "@/lib/changed";
import { emailList, logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  DriveError,
  findOrCreateRootFolder,
  getDriveOwnerToken,
  getFileMeta,
  shareWithEditors,
} from "@/lib/google-drive";

// Task images live in one Drive folder in the Drive owner's account (DRIVE_OWNER_EMAIL),
// shared with SHARE_SCRIPTS_WITH like the scripts. The app serves them through
// /api/attachments/[id], so only signed-in people can see them.
const ATTACHMENTS_FOLDER = "ModuleTracker Attachments";

export type AttachmentResult = { error?: string };

async function findTask(moduleId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, moduleId }, select: { id: true, title: true } });
  if (!task) throw new DriveError("That task no longer exists.");
  return task;
}

/**
 * First half of attaching an image: the browser uploads it straight to Drive (Vercel
 * caps request bodies at ~4.5 MB), so hand it a short-lived, drive.file-scoped owner
 * token and the attachments folder (created and shared on first use).
 */
export async function prepareAttachmentUpload(
  moduleId: string,
  taskId: string
): Promise<AttachmentResult & { accessToken?: string; folderId?: string }> {
  try {
    await requireUser();
    await findTask(moduleId, taskId);
    const token = await getDriveOwnerToken();
    const folder = await findOrCreateRootFolder(token, ATTACHMENTS_FOLDER);
    if (folder.created) {
      const owner = process.env.DRIVE_OWNER_EMAIL?.trim().toLowerCase();
      const people = emailList(process.env.SHARE_SCRIPTS_WITH).filter((e) => e !== owner);
      const failed = await shareWithEditors(token, folder.id, people);
      if (failed.length) console.warn(`[attachments] couldn't share the folder with ${failed.join(", ")}`);
    }
    return { accessToken: token, folderId: folder.id };
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/** Second half: check the uploaded file is an image and attach it to the task. */
export async function registerAttachment(
  moduleId: string,
  taskId: string,
  fileId: string
): Promise<AttachmentResult> {
  try {
    const user = await requireUser();
    const task = await findTask(moduleId, taskId);
    const meta = await getFileMeta(await getDriveOwnerToken(), fileId);
    if (!meta) return { error: "The uploaded image couldn't be found in Google Drive." };
    // SVGs can carry scripts, so they're refused along with anything that isn't an image.
    if (!meta.mimeType.startsWith("image/") || meta.mimeType.includes("svg")) {
      return { error: "Only photos and screenshots (JPEG, PNG, GIF, WebP, HEIC) can be attached." };
    }
    const attachment = await prisma.taskAttachment.create({
      data: { taskId, driveFileId: meta.id, name: meta.name.slice(0, 200), mimeType: meta.mimeType, addedById: user.id },
    });
    await logActivity(user, {
      action: "attachment.add",
      summary: `Attached an image to "${task.title}"`,
      entityType: "taskAttachment",
      entityId: attachment.id,
      moduleId,
      after: attachment,
    });
    changed();
    return {};
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/** Removes an image from its task. The file stays in Drive, so Undo can restore it. */
export async function removeAttachment(moduleId: string, attachmentId: string): Promise<AttachmentResult> {
  const user = await requireUser();
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, task: { moduleId } },
    include: { task: { select: { title: true } } },
  });
  if (!attachment) return {};
  const { task, ...row } = attachment;
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  await logActivity(user, {
    action: "attachment.remove",
    summary: `Removed an image from "${task.title}"`,
    entityType: "taskAttachment",
    entityId: attachmentId,
    moduleId,
    before: row,
  });
  changed();
  return {};
}
