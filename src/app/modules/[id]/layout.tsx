import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import { MODULE_STATUS_LABELS } from "@/lib/labels";
import { ModuleTabs } from "./module-tabs";

export default async function ModuleLayout(props: LayoutProps<"/modules/[id]">) {
  const { id } = await props.params;
  const mod = await getModule(id);
  if (!mod) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← All modules
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mod.number && <span className="text-zinc-500">{mod.number} · </span>}
          {mod.name}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {MODULE_STATUS_LABELS[mod.status]}
          </span>
          {mod.audience && <span>Audience: {mod.audience}</span>}
          {mod.targetCompletion && <span>Target: {mod.targetCompletion}</span>}
          {mod.runtimeMinutes && <span>~{mod.runtimeMinutes} min</span>}
        </div>
      </header>
      <ModuleTabs moduleId={mod.id} />
      {props.children}
    </main>
  );
}
