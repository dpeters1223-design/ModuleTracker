import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScripts } from "@/lib/scripts";
import { moduleTitle } from "@/lib/script-template";

export const metadata: Metadata = { title: "Scripts · ModuleTracker" };

export default async function ScriptsPage() {
  await connection();
  const modules = await prisma.module.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, number: true, name: true },
  });
  const scripts = await getScripts(modules.map((m) => m.id));
  const started = modules.filter((m) => scripts.has(m.id)).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Scripts</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {started} of {modules.length} module{modules.length === 1 ? "" : "s"} have a script
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No modules yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Scripts belong to modules. Create a module with the Discovery Form first.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {modules.map((m) => {
            const script = scripts.get(m.id);
            return (
              <li key={m.id}>
                <Link
                  href={`/scripts/${m.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{moduleTitle(m)}</p>
                    <p className="text-sm text-zinc-500">
                      {script
                        ? script.lastEdited
                          ? `Last edited ${new Date(script.lastEdited).toLocaleDateString()}${
                              script.lastEditedBy ? ` by ${script.lastEditedBy}` : ""
                            }`
                          : "Linked"
                        : "No script yet"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      script
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {script ? "Started" : "Not started"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
