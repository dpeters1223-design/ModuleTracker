import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { dayInZone, timeInZone } from "@/lib/dates";
import { dayLabel } from "@/lib/activity-feed";
import { moduleTitle } from "@/lib/script-template";
import { MediaLibrary, type AssetOption, type MediaRow, type ModuleOption } from "./media-library";

export const metadata: Metadata = { title: "Media library · ModuleTracker" };

const selectCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900";

/**
 * The media library: the files the team actually has, organised by tag rather than by
 * module. Separate from Assets, which tracks what a module still needs — most assets
 * never have a file, and plenty of files belong to no module at all.
 */
export default async function MediaPage(props: PageProps<"/media">) {
  await connection();
  await requireUser();
  const params = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tag = one(params.tag).trim().toLowerCase();
  const moduleId = one(params.module);
  const q = one(params.q).trim();
  const assetParam = one(params.asset);

  const where: Prisma.MediaItemWhereInput = {
    ...(tag ? { tags: { has: tag } } : {}),
    ...(moduleId ? (moduleId === "none" ? { moduleId: null } : { moduleId }) : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, modules, total, tagRows, albums, assetRows] = await Promise.all([
    prisma.mediaItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
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
      },
    }),
    prisma.module.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, number: true, name: true } }),
    prisma.mediaItem.count(),
    // Scalar-list columns have no distinct query, so the tag list is flattened here.
    // Fine at a few hundred rows; revisit if the library grows into the thousands.
    prisma.mediaItem.findMany({ select: { tags: true } }),
    prisma.mediaAlbum.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.moduleAsset.findMany({ select: { id: true, moduleId: true, name: true }, orderBy: { order: "asc" } }),
  ]);

  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const items: MediaRow[] = rows.map((r) => ({
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
  }));
  const moduleOptions: ModuleOption[] = modules.map((m) => ({ id: m.id, label: moduleTitle(m) }));
  const assetOptions: AssetOption[] = assetRows;
  const initialAsset = assetParam ? assetOptions.find((a) => a.id === assetParam) : undefined;
  const filtered = Boolean(tag || moduleId || q);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media library</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {items.length} item{items.length === 1 ? "" : "s"}
            {filtered && ` of ${total}`}
            {tag && ` tagged “${tag}”`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/media/albums"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Albums{albums.length > 0 && ` (${albums.length})`} →
          </Link>
          <Link
            href="/media/assets"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Assets across modules →
          </Link>
        </div>
      </div>

      {/* Plain GET form: filters live in the URL, so a filtered view can be shared. */}
      <form className="mb-4 flex flex-wrap items-center gap-3 text-sm" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search names and descriptions"
          aria-label="Search the library"
          className={`${selectCls} min-w-52`}
        />
        <select name="tag" defaultValue={tag} className={selectCls} aria-label="Tag">
          <option value="">All tags</option>
          {knownTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="module" defaultValue={moduleId} className={selectCls} aria-label="Module">
          <option value="">Any module</option>
          <option value="none">No module</option>
          {moduleOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Apply
        </button>
        {filtered && (
          <Link href="/media" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Clear
          </Link>
        )}
      </form>

      <MediaLibrary
        key={assetParam || "default"}
        items={items}
        modules={moduleOptions}
        assets={assetOptions}
        knownTags={knownTags}
        albums={albums}
        initialAsset={initialAsset}
      />
    </main>
  );
}
