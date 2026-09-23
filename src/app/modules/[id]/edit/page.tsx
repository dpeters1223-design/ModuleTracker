import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import { moduleToDiscovery } from "@/lib/discovery";
import { moduleTitle } from "@/lib/script-template";
import { DiscoveryForm } from "@/components/discovery-form";
import { DeleteModuleButton } from "@/components/delete-module-button";

export const metadata: Metadata = { title: "Edit module · ModuleTracker" };

export default async function EditModulePage(props: PageProps<"/modules/[id]/edit">) {
  const { id } = await props.params;
  const mod = await getModule(id);
  if (!mod) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/modules/${mod.id}`}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Back to module
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit {moduleTitle(mod)}</h1>
      <p className="mt-1 mb-6 text-zinc-600 dark:text-zinc-400">
        Update the Discovery Form answers and scenes.
      </p>
      <DiscoveryForm edit={{ moduleId: mod.id, initial: moduleToDiscovery(mod) }} />

      <section className="mt-12 space-y-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
        <p className="text-sm text-zinc-500">
          Deleting removes the module, its scenes and its tasks from ModuleTracker. The script and
          folder stay in Google Drive.
        </p>
        <DeleteModuleButton moduleId={mod.id} name={moduleTitle(mod)} />
      </section>
    </main>
  );
}
