import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { listAlbums } from "@/lib/media";
import { moduleTitle } from "@/lib/script-template";
import type { ModuleOption } from "../media-library";
import { AlbumGrid } from "./album-grid";
import { parseView, ViewToggle, type GridView } from "@/components/view-toggle";

export const metadata: Metadata = { title: "Albums · ModuleTracker" };

/** Albums: named sets of media, filled by tag and by hand, shown on their module's page. */
export default async function AlbumsPage(props: PageProps<"/media/albums">) {
  await connection();
  await requireUser();
  const params = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const view: GridView = parseView(one(params.view));

  const [albums, modules, tagRows] = await Promise.all([
    listAlbums(),
    prisma.module.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, number: true, name: true } }),
    prisma.mediaItem.findMany({ select: { tags: true } }),
  ]);
  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const moduleOptions: ModuleOption[] = modules.map((m) => ({ id: m.id, label: moduleTitle(m) }));
  const viewHref = (v: GridView) => (v === "large" ? "/media/albums" : `/media/albums?view=${v}`);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/media" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Media library
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Albums</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {albums.length} album{albums.length === 1 ? "" : "s"} · a set of media the team looks at together
          </p>
        </div>
        <ViewToggle view={view} hrefFor={viewHref} />
      </div>

      <AlbumGrid albums={albums} modules={moduleOptions} knownTags={knownTags} view={view} />
    </main>
  );
}
