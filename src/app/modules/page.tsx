import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODULE_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Modules · ModuleTracker" };

export default async function ModulesPage(props: PageProps<"/modules">) {
  await connection();
  const { deleted } = await props.searchParams;
  const modules = await prisma.module.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { scenes: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {deleted && (
        <div
          role="status"
          className="mb-6 rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
        >
          Module deleted.
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {modules.length} module{modules.length === 1 ? "" : "s"}
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No modules yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            <Link href="/discovery/new" className="underline underline-offset-4">
              Start one with the Discovery Form
            </Link>
            . It captures the topic, learning objectives, tools and a scene-by-scene outline.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {modules.map((m) => (
            <li key={m.id}>
              <Link
                href={`/modules/${m.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.number && <span className="text-zinc-500">{m.number} · </span>}
                    {m.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {m._count.scenes} scene{m._count.scenes === 1 ? "" : "s"}
                    {m.targetCompletion && ` · Target ${m.targetCompletion}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {MODULE_STATUS_LABELS[m.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
