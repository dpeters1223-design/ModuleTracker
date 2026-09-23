import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";

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

  return (
    <div className="space-y-8">
      {submitted && (
        <div
          role="status"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          Discovery Form submitted. The module has been created. Next, start its script from the
          Script tab.
        </div>
      )}

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
    </div>
  );
}
