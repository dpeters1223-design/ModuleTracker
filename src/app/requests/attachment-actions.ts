"use server";

import { changed } from "@/lib/changed";
import { emailList, logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAllowedMime } from "@/lib/attachments";
import {
  DriveError,
  findOrCreateRootFolder,
  getDriveOwnerToken,
  getFileMeta,
  shareWithEditors,
} from "@/lib/google-drive";

// Same shared Drive folder task/asset attachments use — these are the same kind of
// thing (an image living in the Drive owner's account, served through our own route).
const ATTACHMENTS_FOLDER = "ModuleTracker Attachments";

export type AttachmentResult = { error?: string };

/** First half: a short-lived upload token for the shared attachments folder. */
export async function prepareFeatureRequestAttachmentUpload(
  featureRequestId: string
): Promise<AttachmentResult & { accessToken?: string; folderId?: string }> {
  try {
    await requireUser();
    const request = await prisma.featureRequest.findUnique({ where: { id: featureRequestId }, select: { id: true } });
    if (!request) throw new DriveError("That feature request no longer exists.");
    const token = await getDriveOwnerToken();
    const folder = await findOrCreateRootFolder(token, ATTACHMENTS_FOLDER);
    if (folder.created) {
      const owner = process.env.DRIVE_OWNER_EMAIL?.trim().toLowerCase();
      const people = emailList(process.env.SHARE_SCRIPTS_WITH).filter((e) => e !== owner);
      const failed = await shareWithEditors(token, folder.id, people);
      if (failed.length) console.warn(`[feature-request attachments] couldn't share the folder with ${failed.join(", ")}`);
    }
    return { accessToken: token, folderId: folder.id };
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/** Second half: check the uploaded file is an allowed type and attach it. */
export async function registerFeatureRequestAttachment(featureRequestId: string, fileId: string): Promise<AttachmentResult> {
  try {
    const user = await requireUser();
    const request = await prisma.featureRequest.findUnique({ where: { id: featureRequestId }, select: { title: true } });
    if (!request) throw new DriveError("That feature request no longer exists.");
    const meta = await getFileMeta(await getDriveOwnerToken(), fileId);
    if (!meta) return { error: "The uploaded file couldn't be found in Google Drive." };
    if (!isAllowedMime(meta.mimeType)) {
      return { error: `${meta.mimeType || "That kind of file"} can't be attached.` };
    }
    const attachment = await prisma.featureRequestAttachment.create({
      data: { featureRequestId, driveFileId: meta.id, name: meta.name.slice(0, 200), mimeType: meta.mimeType, addedById: user.id },
    });
    await logActivity(user, {
      action: "featureRequestAttachment.add",
      summary: `Attached an image to feature request "${request.title}"`,
      entityType: "featureRequest",
      entityId: attachment.id,
      after: attachment,
    });
    changed();
    return {};
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/** Removes an image. The file stays in Drive, so Undo can restore it. */
export async function removeFeatureRequestAttachment(attachmentId: string): Promise<AttachmentResult> {
  const user = await requireUser();
  const attachment = await prisma.featureRequestAttachment.findUnique({
    where: { id: attachmentId },
    include: { featureRequest: { select: { title: true } } },
  });
  if (!attachment) return {};
  const { featureRequest, ...row } = attachment;
  await prisma.featureRequestAttachment.delete({ where: { id: attachmentId } });
  await logActivity(user, {
    action: "featureRequestAttachment.remove",
    summary: `Removed an image from feature request "${featureRequest.title}"`,
    entityType: "featureRequest",
    entityId: attachmentId,
    before: row,
  });
  changed();
  return {};
}
