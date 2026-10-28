import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getAlbum } from "@/lib/media";
import { moduleTitle } from "@/lib/script-template";
import { MediaTile, type ModuleOption } from "../../media-library";

export async function generateMetadata(props: PageProps<"/media/albums/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const album = await prisma.mediaAlbum.findUnique({ where: { id }, select: { name: true } });
  return { title: album ? `${album.name} · ModuleTracker` : "Album · ModuleTracker" };
}

/** One album: everything its tags pull in, plus everything pinned into it by hand. */
export default async function AlbumPage(props: PageProps<"/media/albums/[id]">) {
  await connection();
  await requireUser();
  const { id } = await props.params;

  const [album, modules, tagRows] = await Promise.all([
    getAlbum(id),
    prisma.module.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, number: true, name: true } }),
    prisma.mediaItem.findMany({ select: { tags: true } }),
  ]);
  if (!album) notFound();

  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const moduleOptions: ModuleOption[] = modules.map((m) => ({ id: m.id, label: moduleTitle(m) }));
  const byTag = album.items.filter((i) => !i.pinned).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/media/albums" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Albums
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{album.name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {album.items.length} item{album.items.length === 1 ? "" : "s"}
          {byTag > 0 && ` · ${byTag} pulled in by tag`}
          {album.moduleLabel && (
            <>
              {" · "}
              <Link href={`/modules/${album.moduleId}`} className="hover:underline underline-offset-4">
                {album.moduleLabel}
              </Link>
            </>
          )}
        </p>
        {album.description && (
          <p className="mt-2 max-w-prose text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
            {album.description}
          </p>
        )}
        {album.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {album.tags.map((t) => (
              <li key={t}>
                <Link
                  href={`/media?tag=${encodeURIComponent(t)}`}
                  className="block rounded-full bg-teal-light px-2.5 py-0.5 text-xs font-medium text-brand hover:underline dark:bg-teal/25 dark:text-teal-light"
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {album.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-600">
          <p className="font-medium">This album is empty</p>
          <p className="mt-1 text-sm text-zinc-500">
            {album.tags.length
              ? `Nothing in the library is tagged ${album.tags.map((t) => `“${t}”`).join(" or ")} yet.`
              : "Add items from the library with “Add to album”, or give the album a tag to fill it automatically."}
          </p>
          <Link href="/media" className="mt-3 inline-block text-sm underline underline-offset-4">
            Go to the library
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {album.items.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              modules={moduleOptions}
              knownTags={knownTags}
              album={{ id: album.id, pinned: item.pinned }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
