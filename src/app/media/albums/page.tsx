import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { listAlbums } from "@/lib/media";
import { moduleTitle } from "@/lib/script-template";
import type { ModuleOption } from "../media-library";
import { AlbumGrid } from "./album-grid";

export const metadata: Metadata = { title: "Albums · ModuleTracker" };

/** Albums: named sets of media, filled by tag and by hand, shown on their module's page. */
export default async function AlbumsPage() {
  await connection();
  await requireUser();

  const [albums, modules, tagRows] = await Promise.all([
    listAlbums(),
    prisma.module.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, number: true, name: true } }),
    prisma.mediaItem.findMany({ select: { tags: true } }),
  ]);
  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const moduleOptions: ModuleOption[] = modules.map((m) => ({ id: m.id, label: moduleTitle(m) }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/media" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Media library
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Albums</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {albums.length} album{albums.length === 1 ? "" : "s"} · a set of media the team looks at together
        </p>
      </div>

      <AlbumGrid albums={albums} modules={moduleOptions} knownTags={knownTags} />
    </main>
  );
}
