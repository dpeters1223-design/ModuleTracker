import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayInZone, timeInZone } from "@/lib/dates";
import { dayLabel } from "@/lib/activity-feed";
import { moduleTitle } from "@/lib/script-template";
import { isImageMime } from "@/lib/attachments";
import type { MediaRow } from "@/app/media/media-library";

/** Tags are matched case-insensitively, so they are stored lowercased. */
export function cleanTags(tags: string[]): string[] {
  const out = tags
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((t) => t.slice(0, 40));
  return [...new Set(out)].slice(0, 20);
}

/** Everything a library tile needs, in one place so every view shows the same thing. */
export const MEDIA_ROW_SELECT = {
  id: true,
  name: true,
  description: true,
  tags: true,
  mimeType: true,
  url: true,
  driveFileId: true,
  createdAt: true,
  moduleId: true,
  sceneId: true,
  assetId: true,
  module: { select: { number: true, name: true } },
  addedBy: { select: { name: true, email: true } },
} satisfies Prisma.MediaItemSelect;

type MediaRecord = Prisma.MediaItemGetPayload<{ select: typeof MEDIA_ROW_SELECT }>;

export function toMediaRow(r: MediaRecord): MediaRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags,
    mimeType: r.mimeType,
    url: r.url,
    hasFile: Boolean(r.driveFileId),
    addedBy: r.addedBy?.name ?? r.addedBy?.email ?? null,
    when: `${dayLabel(dayInZone(r.createdAt))} at ${timeInZone(r.createdAt)}`,
    moduleId: r.moduleId,
    moduleLabel: r.module ? moduleTitle(r.module) : null,
    sceneId: r.sceneId,
    assetId: r.assetId,
  };
}

// ── Albums ────────────────────────────────────────────────────────────────────
// An album's contents are two things at once: everything carrying one of its tags,
// plus anything pinned in by hand. Only the pins are stored, so re-tagging an image
// moves it between albums with no album to edit.

export type AlbumCover = { id: string; isImage: boolean };

export type AlbumSummary = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  moduleId: string | null;
  moduleLabel: string | null;
  /** Hand-pinned, tag-matched, and the total after the overlap is removed. */
  pinned: number;
  matched: number;
  count: number;
  covers: AlbumCover[];
};

const ALBUM_SELECT = {
  id: true,
  name: true,
  description: true,
  tags: true,
  moduleId: true,
  module: { select: { number: true, name: true } },
  items: { select: { mediaId: true }, orderBy: { order: "asc" } },
} satisfies Prisma.MediaAlbumSelect;

/** Pins first, in the order they were pinned; then tag matches, newest first. */
function members<T extends { id: string; tags: string[] }>(
  album: { tags: string[]; items: { mediaId: string }[] },
  all: T[]
): T[] {
  const byId = new Map(all.map((m) => [m.id, m]));
  const pinned = album.items.map((i) => byId.get(i.mediaId)).filter((m): m is T => Boolean(m));
  const seen = new Set(pinned.map((m) => m.id));
  const matched = album.tags.length
    ? all.filter((m) => !seen.has(m.id) && m.tags.some((t) => album.tags.includes(t)))
    : [];
  return [...pinned, ...matched];
}

/**
 * Albums with their sizes and cover thumbnails. Membership is worked out here rather
 * than in SQL, which means reading every media row once — the same trade-off the tag
 * list on /media makes, and fine at a few hundred items. Revisit past a few thousand.
 */
export async function listAlbums(where: Prisma.MediaAlbumWhereInput = {}): Promise<AlbumSummary[]> {
  const [albums, all] = await Promise.all([
    prisma.mediaAlbum.findMany({ where, orderBy: { name: "asc" }, select: ALBUM_SELECT }),
    prisma.mediaItem.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, tags: true, mimeType: true, driveFileId: true },
    }),
  ]);

  return albums.map((a) => {
    const items = members(a, all);
    const pinned = a.items.filter((i) => all.some((m) => m.id === i.mediaId)).length;
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      tags: a.tags,
      moduleId: a.moduleId,
      moduleLabel: a.module ? moduleTitle(a.module) : null,
      pinned,
      matched: items.length - pinned,
      count: items.length,
      covers: items.slice(0, 4).map((m) => ({
        id: m.id,
        isImage: Boolean(m.driveFileId) && isImageMime(m.mimeType ?? ""),
      })),
    };
  });
}

/** One album with its contents, ready for the grid. Null if it's gone. */
export async function getAlbum(id: string) {
  const album = await prisma.mediaAlbum.findUnique({
    where: { id },
    select: { ...ALBUM_SELECT, createdBy: { select: { name: true, email: true } } },
  });
  if (!album) return null;
  const all = await prisma.mediaItem.findMany({
    orderBy: { createdAt: "desc" },
    select: MEDIA_ROW_SELECT,
  });
  const items = members(album, all);
  const pins = new Set(album.items.map((i) => i.mediaId));
  return {
    ...album,
    moduleLabel: album.module ? moduleTitle(album.module) : null,
    addedBy: album.createdBy?.name ?? album.createdBy?.email ?? null,
    items: items.map((m) => ({ ...toMediaRow(m), pinned: pins.has(m.id) })),
  };
}
