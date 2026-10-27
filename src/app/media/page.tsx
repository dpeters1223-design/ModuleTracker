import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import type { AssetStatus, AssetType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { moduleTitle } from "@/lib/script-template";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_STYLES,
  ASSET_STATUSES,
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
} from "@/lib/assets";

export const metadata: Metadata = { title: "Media · ModuleTracker" };

const selectCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900";

/** Every media item the team is tracking, across all modules rather than one at a time. */
export default async function MediaPage(props: PageProps<"/media">) {
  await connection();
  await requireUser();
  const params = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const moduleId = one(params.module);
  const type = one(params.type);
  const status = one(params.status);
  const q = one(params.q).trim();

  const where: Prisma.ModuleAssetWhereInput = {
    ...(moduleId ? { moduleId } : {}),
    ...(ASSET_TYPES.includes(type as AssetType) ? { type: type as AssetType } : {}),
    ...(ASSET_STATUSES.includes(status as AssetStatus) ? { status: status as AssetStatus } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            { owner: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [assets, modules, total] = await Promise.all([
    prisma.moduleAsset.findMany({
      where,
      orderBy: [{ moduleId: "asc" }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        owner: true,
        url: true,
        notes: true,
        module: { select: { id: true, number: true, name: true } },
        scene: { select: { order: true, title: true } },
        attachments: { select: { id: true, name: true, mimeType: true }, orderBy: { addedAt: "asc" } },
      },
    }),
    prisma.module.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, number: true, name: true } }),
    prisma.moduleAsset.count(),
  ]);

  const filtered = Boolean(moduleId || type || status || q);
  const files = assets.reduce((n, a) => n + a.attachments.length, 0);

  // Grouped by module, in the module list's own order, so the library reads the way
  // the rest of the app is organised.
  const groups = modules
    .map((m) => ({ module: m, items: assets.filter((a) => a.module.id === m.id) }))
    .filter((g) => g.items.length);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {assets.length} item{assets.length === 1 ? "" : "s"}
          {filtered && ` of ${total}`} · {files} file{files === 1 ? "" : "s"} uploaded
        </p>
      </div>

      {/* Plain GET form: filters live in the URL, so a filtered view can be bookmarked or shared. */}
      <form className="mb-6 flex flex-wrap items-center gap-3 text-sm" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search names, owners, notes"
          aria-label="Search media"
          className={`${selectCls} min-w-52`}
        />
        <select name="module" defaultValue={moduleId} className={selectCls} aria-label="Module">
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {moduleTitle(m)}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type} className={selectCls} aria-label="Type">
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ASSET_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={selectCls} aria-label="Status">
          <option value="">Any status</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ASSET_STATUS_LABELS[s]}
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

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-600">
          <p className="font-medium">{filtered ? "Nothing matches those filters" : "No media tracked yet"}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {filtered
              ? "Try a different module, type or status."
              : "Media is listed per module, under Assets on the module's page."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ module: m, items }) => (
            <section key={m.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold tracking-tight">
                  <Link href={`/modules/${m.id}`} className="hover:underline underline-offset-4">
                    {moduleTitle(m)}
                  </Link>
                </h2>
                <p className="text-xs text-zinc-500">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="divide-y divide-zinc-300 rounded-lg border border-zinc-300 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-950">
                {items.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-zinc-500">
                        {[
                          ASSET_TYPE_LABELS[a.type],
                          a.owner,
                          a.scene ? `Scene ${a.scene.order}${a.scene.title ? `: ${a.scene.title}` : ""}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {a.notes && (
                        // Some notes are whole paragraphs (a module description, say); the
                        // full text is on the module's own page.
                        <p
                          title={a.notes}
                          className="mt-1 line-clamp-2 text-xs whitespace-pre-wrap text-zinc-600 dark:text-zinc-400"
                        >
                          {a.notes}
                        </p>
                      )}
                      {a.attachments.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {a.attachments.map((f) => (
                            <li key={f.id}>
                              <a
                                href={`/api/attachments/${f.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={f.name}
                                className="block overflow-hidden rounded border border-zinc-300 dark:border-zinc-700"
                              >
                                <Image
                                  src={`/api/attachments/${f.id}`}
                                  alt={f.name}
                                  width={72}
                                  height={72}
                                  unoptimized
                                  className="h-16 w-16 object-cover"
                                />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          Link ↗
                        </a>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_STYLES[a.status]}`}
                      >
                        {ASSET_STATUS_LABELS[a.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
