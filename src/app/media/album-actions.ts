"use server";

import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cleanTags } from "@/lib/media";

export type AlbumResult = { errors?: string[] };

export type AlbumInput = {
  name: string;
  description: string;
  /** Any media item carrying one of these is in the album automatically. */
  tags: string[];
  /** Attaching an album to a module is what puts it on that module's page. */
  moduleId: string;
};

export async function createAlbum(input: AlbumInput): Promise<AlbumResult & { id?: string }> {
  const user = await requireUser();
  if (!input.name.trim()) return { errors: ["Give the album a name."] };

  const album = await prisma.mediaAlbum.create({
    data: {
      name: input.name.trim().slice(0, 120),
      description: input.description.trim() || null,
      tags: cleanTags(input.tags),
      moduleId: input.moduleId || null,
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
  return { id: album.id };
}

export async function updateAlbum(id: string, input: AlbumInput): Promise<AlbumResult> {
  const user = await requireUser();
  if (!input.name.trim()) return { errors: ["Give the album a name."] };
  const before = await prisma.mediaAlbum.findUnique({ where: { id } });
  if (!before) return { errors: ["That album no longer exists."] };

  const after = await prisma.mediaAlbum.update({
    where: { id },
    data: {
      name: input.name.trim().slice(0, 120),
      description: input.description.trim() || null,
      tags: cleanTags(input.tags),
      moduleId: input.moduleId || null,
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
