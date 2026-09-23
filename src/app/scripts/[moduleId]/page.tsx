import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import { getScript } from "@/lib/scripts";
import { moduleTitle } from "@/lib/script-template";
import { ScriptPanel } from "@/components/script-panel";

export default async function ModuleScriptPage(props: PageProps<"/scripts/[moduleId]">) {
  const { moduleId } = await props.params;
  const mod = await getModule(moduleId);
  if (!mod) notFound();
  const script = await getScript(mod.id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/scripts"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All scripts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{moduleTitle(mod)}: Script</h1>
        <p className="text-sm text-zinc-500">
          Part of module{" "}
          <Link
            href={`/modules/${mod.id}`}
            className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {moduleTitle(mod)}
          </Link>{" "}
          · {mod.scenes.length} scene{mod.scenes.length === 1 ? "" : "s"} outlined
        </p>
      </header>
      <ScriptPanel moduleId={mod.id} script={script} />
    </main>
  );
}
