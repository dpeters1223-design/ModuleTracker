import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { dayInZone, timeInZone } from "@/lib/dates";
import { dayLabel } from "@/lib/activity-feed";
import { moduleTitle } from "@/lib/script-template";
import { MediaLibrary, type AssetOption, type MediaRow, type MediaView, type ModuleOption } from "./media-library";

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
  const view: MediaView = one(params.view) === "small" || one(params.view) === "list" ? (one(params.view) as MediaView) : "large";

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

  // Keeps the current filters when switching views — only `view` itself changes.
  const viewHref = (v: MediaView) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (tag) qs.set("tag", tag);
    if (moduleId) qs.set("module", moduleId);
    if (v !== "large") qs.set("view", v);
    const s = qs.toString();
    return `/media${s ? `?${s}` : ""}`;
  };
  const VIEW_LABELS: Record<MediaView, string> = { large: "Large icons", small: "Small icons", list: "List" };

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-600" role="group" aria-label="View">
            {(["large", "small", "list"] as const).map((v) => (
              <Link
                key={v}
                href={viewHref(v)}
                aria-label={VIEW_LABELS[v]}
                title={VIEW_LABELS[v]}
                aria-current={view === v ? "true" : undefined}
                className={`rounded px-2 py-1.5 ${
                  view === v
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {v === "large" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <rect x="3" y="3" width="8" height="8" rx="1" />
                    <rect x="13" y="3" width="8" height="8" rx="1" />
                    <rect x="3" y="13" width="8" height="8" rx="1" />
                    <rect x="13" y="13" width="8" height="8" rx="1" />
                  </svg>
                )}
                {v === "small" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    {[3, 9.75, 16.5].flatMap((x) =>
                      [3, 9.75, 16.5].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="4.5" height="4.5" rx="0.8" />)
                    )}
                  </svg>
                )}
                {v === "list" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                )}
              </Link>
            ))}
          </div>
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
        {view !== "large" && <input type="hidden" name="view" value={view} />}
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
        view={view}
      />
    </main>
  );
}
