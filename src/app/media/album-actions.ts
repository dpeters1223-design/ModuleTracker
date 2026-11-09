"use server";

import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { appUrl } from "@/lib/slack";
import { notifyMentions, parseMentions } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cleanTags } from "@/lib/media";
import type { MediaReviewStatus } from "@prisma/client";

export type AlbumResult = { errors?: string[] };

export type AlbumInput = {
  name: string;
  description: string;
  /** Any media item carrying one of these is in the album automatically. */
  tags: string[];
  /** Attaching an album to a module is what puts it on that module's page. */
  moduleId: string;
  /** Flags this as a set someone should check item by item (e.g. for Tom). */
  needsReview: boolean;
};

/** @mentions in `note` (e.g. "@Tom Pennell can you check these?") get pinged. */
async function notifyReviewers(from: { id: string; name: string }, note: string, link: string) {
  const text = note.trim();
  if (!text) return;
  const mentioned = await parseMentions(text);
  notifyMentions(mentioned, from, text, link);
}

export async function createAlbum(input: AlbumInput, reviewNote = ""): Promise<AlbumResult & { id?: string }> {
  const user = await requireUser();
  if (!input.name.trim()) return { errors: ["Give the album a name."] };
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });

  const album = await prisma.mediaAlbum.create({
    data: {
      name: input.name.trim().slice(0, 120),
      description: input.description.trim() || null,
      tags: cleanTags(input.tags),
      moduleId: input.moduleId || null,
      needsReview: input.needsReview,
      createdById: user.id,
    },
  });
  await logActivity(user, {
    action: "mediaAlbum.create",
    summary: `Created the album "${album.name}"`,
    entityType: "mediaAlbum",
    entityId: album.id,
    moduleId: album.moduleId,
    after: album,
  });
  changed();
  if (input.needsReview) {
    await notifyReviewers({ id: user.id, name: me?.name ?? user.email }, reviewNote, appUrl(`/media/albums/${album.id}`));
  }
  return { id: album.id };
}

export async function updateAlbum(id: string, input: AlbumInput, reviewNote = ""): Promise<AlbumResult> {
  const user = await requireUser();
  if (!input.name.trim()) return { errors: ["Give the album a name."] };
  const before = await prisma.mediaAlbum.findUnique({ where: { id } });
  if (!before) return { errors: ["That album no longer exists."] };
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });

  const after = await prisma.mediaAlbum.update({
    where: { id },
    data: {
      name: input.name.trim().slice(0, 120),
      description: input.description.trim() || null,
      tags: cleanTags(input.tags),
      moduleId: input.moduleId || null,
      needsReview: input.needsReview,
    },
  });
  await logActivity(user, {
    action: "mediaAlbum.edit",
    summary: `Edited the album "${after.name}"`,
    entityType: "mediaAlbum",
    entityId: id,
    moduleId: after.moduleId,
    before,
    after,
  });
  changed();
  // Only ping on the transition to needing review — not on every later edit.
  if (input.needsReview && !before.needsReview) {
    await notifyReviewers({ id: user.id, name: me?.name ?? user.email }, reviewNote, appUrl(`/media/albums/${id}`));
  }
  return {};
}

/**
 * Sets (or clears, back to pending) one person's review of one item in an album.
 * Keyed on the pair rather than living on MediaAlbumItem because a tag-matched item
 * has no row there at all (src/lib/media.ts's members()).
 */
export async function setMediaReview(
  albumId: string,
  mediaId: string,
  status: MediaReviewStatus,
  note: string
): Promise<AlbumResult> {
  const user = await requireUser();
  const [album, media, existing] = await Promise.all([
    prisma.mediaAlbum.findUnique({ where: { id: albumId }, select: { id: true, name: true, moduleId: true } }),
    prisma.mediaItem.findUnique({ where: { id: mediaId }, select: { id: true, name: true } }),
    prisma.mediaReview.findUnique({ where: { albumId_mediaId: { albumId, mediaId } } }),
  ]);
  if (!album) return { errors: ["That album no longer exists."] };
  if (!media) return { errors: ["That item is no longer in the library."] };
  if (status === "changes_requested" && !note.trim()) {
    return { errors: ["Say what needs to change."] };
  }

  const before = { status: existing?.status ?? "pending", note: existing?.note ?? null };
  const text = note.trim().slice(0, 2000) || null;
  const after =
    status === "pending"
      ? existing
        ? await prisma.mediaReview.delete({ where: { id: existing.id } })
        : null
      : await prisma.mediaReview.upsert({
          where: { albumId_mediaId: { albumId, mediaId } },
          create: { albumId, mediaId, status, note: text, reviewedById: user.id },
          update: { status, note: text, reviewedById: user.id },
        });

  await logActivity(user, {
    action: "mediaReview.set",
    summary: `Marked "${media.name}" ${status.replace("_", " ")} in "${album.name}"`,
    entityType: "mediaReview",
    entityId: existing?.id ?? after?.id,
    moduleId: album.moduleId,
    before,
    after: { status, note: text },
  });
  changed();

  if (status === "changes_requested" && text) {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
    const mentioned = await parseMentions(text);
    notifyMentions(mentioned, { id: user.id, name: me?.name ?? user.email }, text, appUrl(`/media/albums/${albumId}`));
  }
  return {};
}

/** Deletes the album only — the media in it stays in the library. */
export async function deleteAlbum(id: string): Promise<AlbumResult> {
  const user = await requireUser();
  const before = await prisma.mediaAlbum.findUnique({ where: { id }, include: { items: true } });
  if (!before) return {};
  await prisma.mediaAlbum.delete({ where: { id } });
  await logActivity(user, {
    action: "mediaAlbum.delete",
    summary: `Deleted the album "${before.name}"`,
    entityType: "mediaAlbum",
    entityId: id,
    moduleId: before.moduleId,
    before,
  });
  changed();
  return {};
}

/**
 * Pins an item into an album, or removes the pin. An item matched by one of the
 * album's tags needs no pin, so unpinning it leaves it in the album — the UI says so
 * rather than silently doing nothing.
 */
export async function setAlbumPin(albumId: string, mediaId: string, pinned: boolean): Promise<AlbumResult> {
  const user = await requireUser();
  const [album, media] = await Promise.all([
    prisma.mediaAlbum.findUnique({ where: { id: albumId }, select: { id: true, name: true, moduleId: true } }),
    prisma.mediaItem.findUnique({ where: { id: mediaId }, select: { id: true, name: true } }),
  ]);
  if (!album) return { errors: ["That album no longer exists."] };
  if (!media) return { errors: ["That item is no longer in the library."] };

  const existing = await prisma.mediaAlbumItem.findUnique({
    where: { albumId_mediaId: { albumId, mediaId } },
  });
  // Pinning or unpinning twice is a no-op rather than an error: two people can hit
  // "Add to album" on the same tile.
  if (pinned === Boolean(existing)) return {};

  let before = existing;
  let after = null as typeof existing;
  if (pinned) {
    const last = await prisma.mediaAlbumItem.findFirst({
      where: { albumId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    after = await prisma.mediaAlbumItem.create({
      data: { albumId, mediaId, order: (last?.order ?? -1) + 1 },
    });
    before = null;
  } else {
    await prisma.mediaAlbumItem.delete({ where: { id: existing!.id } });
  }

  await logActivity(user, {
    action: pinned ? "mediaAlbumItem.add" : "mediaAlbumItem.remove",
    summary: pinned
      ? `Added "${media.name}" to the album "${album.name}"`
      : `Removed "${media.name}" from the album "${album.name}"`,
    entityType: "mediaAlbumItem",
    entityId: (after ?? before)?.id,
    moduleId: album.moduleId,
    before,
    after,
  });
  changed();
  return {};
}
