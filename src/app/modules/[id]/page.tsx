import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import { getScript } from "@/lib/scripts";
import { MODULE_STATUS_LABELS } from "@/lib/labels";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function Lines({ text }: { text: string | null }) {
  if (!text) return <p className="text-sm text-zinc-400">Not provided</p>;
  return <p className="whitespace-pre-wrap text-sm">{text}</p>;
}

export default async function ModuleOverviewPage(props: PageProps<"/modules/[id]">) {
  const { id } = await props.params;
  const { submitted } = await props.searchParams;
  const mod = await getModule(id);
  if (!mod) notFound();

  const objectives = mod.learningObjectives?.split("\n").filter(Boolean) ?? [];
  const script = await getScript(mod.id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      {submitted && (
        <div
          role="status"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          Discovery Form submitted. The module has been created.{" "}
          <Link href={`/scripts/${mod.id}`} className="font-medium underline underline-offset-4">
            Start its script →
          </Link>
        </div>
      )}

      <header className="space-y-2">
        <Link
          href="/modules"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
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

      <Link
        href={`/scripts/${mod.id}`}
        className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        <span>
          <span className="font-medium">Script: </span>
          {script
            ? script.lastEdited
              ? `last edited ${new Date(script.lastEdited).toLocaleDateString()}${
                  script.lastEditedBy ? ` by ${script.lastEditedBy}` : ""
                }`
              : "linked"
            : "not started"}
        </span>
        <span className="text-zinc-500">{script ? "Open →" : "Start →"}</span>
      </Link>

      <Section title="What it's about">
        <Lines text={mod.description} />
      </Section>

      <Section title="Learning objectives">
        {objectives.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ol>
        ) : (
          <Lines text={null} />
        )}
      </Section>

      <Section title="Tools">
        <Lines text={mod.toolsUsed} />
      </Section>

      {mod.featuresDiscussed && (
        <Section title="Features discussed">
          <Lines text={mod.featuresDiscussed} />
        </Section>
      )}

      <Section title={`Scenes (${mod.scenes.length})`}>
        {mod.scenes.length === 0 && <Lines text={null} />}
        <ol className="space-y-3">
          {mod.scenes.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
            >
              <p className="font-medium">
                {s.order}. {s.title || <span className="text-zinc-400">Untitled scene</span>}
              </p>
              <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr]">
                {(
                  [
                    ["Location", s.location],
                    ["Speaker", s.speaker],
                    ["Tool", s.toolUsed],
                    ["Background", s.backgroundMediaType],
                    ["Highlighted", s.interactionHighlighted],
                    ["Activities", s.activities],
                    ["Notes", s.notes],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="whitespace-pre-wrap">{v}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ol>
      </Section>
    </main>
  );
}
