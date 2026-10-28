"use server";

import { changed } from "@/lib/changed";
import { emailList, logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAllowedMime } from "@/lib/attachments";
import { cleanTags } from "@/lib/media";
import {
  DriveError,
  findOrCreateRootFolder,
  getDriveOwnerToken,
  getFileMeta,
  shareWithEditors,
} from "@/lib/google-drive";

// Library files live in their own folder in the Drive owner's account, shared with
// SHARE_SCRIPTS_WITH like the scripts and attachments. The app serves them through
// /api/media/[id], so only signed-in people can see them.
const MEDIA_FOLDER = "ModuleTracker Media";

export type MediaResult = { errors?: string[] };

/**
 * First half of an upload: the browser sends the file straight to Drive (Vercel caps
 * request bodies at ~4.5 MB), so hand it a short-lived, drive.file-scoped owner token
 * and the library folder, created and shared on first use.
 */
export async function prepareMediaUpload(): Promise<MediaResult & { accessToken?: string; folderId?: string }> {
  try {
    await requireUser();
    const token = await getDriveOwnerToken();
    const folder = await findOrCreateRootFolder(token, MEDIA_FOLDER);
    if (folder.created) {
      const owner = process.env.DRIVE_OWNER_EMAIL?.trim().toLowerCase();
      const people = emailList(process.env.SHARE_SCRIPTS_WITH).filter((e) => e !== owner);
      const failed = await shareWithEditors(token, folder.id, people);
      if (failed.length) console.warn(`[media] couldn't share the folder with ${failed.join(", ")}`);
    }
    return { accessToken: token, folderId: folder.id };
  } catch (e) {
    if (e instanceof DriveError) return { errors: [e.message] };
    throw e;
  }
}

export type MediaInput = {
  name: string;
  description: string;
  tags: string[];
  moduleId: string;
  sceneId: string;
  assetId: string;
};

/** Second half: check what Drive actually received, then add it to the library. */
export async function registerMedia(
  fileId: string,
  thumbFileId: string | null,
  input: MediaInput
): Promise<MediaResult & { id?: string }> {
  try {
    const user = await requireUser();
    const meta = await getFileMeta(await getDriveOwnerToken(), fileId);
    if (!meta) return { errors: ["The uploaded file couldn't be found in Google Drive."] };
    if (!isAllowedMime(meta.mimeType)) {
      return { errors: [`${meta.mimeType || "That kind of file"} can't be added to the library.`] };
    }
    const item = await prisma.mediaItem.create({
      data: {
        name: (input.name.trim() || meta.name).slice(0, 200),
        description: input.description.trim() || null,
        tags: cleanTags(input.tags),
        driveFileId: meta.id,
        mimeType: meta.mimeType,
        thumbFileId,
        moduleId: input.moduleId || null,
        sceneId: input.sceneId || null,
        assetId: input.assetId || null,
        addedById: user.id,
      },
    });
    await logActivity(user, {
      action: "mediaItem.add",
      summary: `Added "${item.name}" to the media library`,
      entityType: "mediaItem",
      entityId: item.id,
      moduleId: item.moduleId,
      after: item,
    });
    changed();
    return { id: item.id };
  } catch (e) {
    if (e instanceof DriveError) return { errors: [e.message] };
    throw e;
  }
}

/** Adds a link to media held somewhere else, rather than a file of our own. */
export async function addMediaLink(url: string, input: MediaInput): Promise<MediaResult & { id?: string }> {
  const user = await requireUser();
  const link = url.trim();
  if (!/^https:\/\//i.test(link)) return { errors: ["The link must start with https://"] };
  if (!input.name.trim()) return { errors: ["Give it a name."] };

  const item = await prisma.mediaItem.create({
    data: {
      name: input.name.trim().slice(0, 200),
      description: input.description.trim() || null,
      tags: cleanTags(input.tags),
      url: link,
      moduleId: input.moduleId || null,
      sceneId: input.sceneId || null,
      assetId: input.assetId || null,
      addedById: user.id,
    },
  });
  await logActivity(user, {
    action: "mediaItem.add",
    summary: `Linked "${item.name}" in the media library`,
    entityType: "mediaItem",
    entityId: item.id,
    moduleId: item.moduleId,
    after: item,
  });
  changed();
  return { id: item.id };
}

/** Renames, re-tags or re-files a library item. */
export async function updateMedia(id: string, input: MediaInput): Promise<MediaResult> {
  const user = await requireUser();
  const before = await prisma.mediaItem.findUnique({ where: { id } });
  if (!before) return { errors: ["That item is no longer in the library."] };
  if (!input.name.trim()) return { errors: ["Give it a name."] };

  const after = await prisma.mediaItem.update({
    where: { id },
    data: {
      name: input.name.trim().slice(0, 200),
      description: input.description.trim() || null,
      tags: cleanTags(input.tags),
      moduleId: input.moduleId || null,
      sceneId: input.sceneId || null,
      assetId: input.assetId || null,
    },
  });
  await logActivity(user, {
    action: "mediaItem.edit",
    summary: `Edited "${after.name}" in the media library`,
    entityType: "mediaItem",
    entityId: id,
    moduleId: after.moduleId,
    before,
    after,
  });
  changed();
  return {};
}

/** Removes an item. The Drive file stays, so an undo can restore the row. */
export async function removeMedia(id: string): Promise<MediaResult> {
  const user = await requireUser();
  const before = await prisma.mediaItem.findUnique({ where: { id } });
  if (!before) return {};
  await prisma.mediaItem.delete({ where: { id } });
  await logActivity(user, {
    action: "mediaItem.remove",
    summary: `Removed "${before.name}" from the media library`,
    entityType: "mediaItem",
    entityId: id,
    moduleId: before.moduleId,
    before,
  });
  changed();
  return {};
}
