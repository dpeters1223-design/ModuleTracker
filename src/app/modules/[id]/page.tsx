import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODULE_STATUS_LABELS } from "@/lib/labels";
import { auth } from "@/auth";
import { getFileMeta, getGoogleAccessToken } from "@/lib/google-drive";
import { ScriptPanel, type ScriptInfo } from "./script-panel";

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

export default async function ModulePage(props: PageProps<"/modules/[id]">) {
  await connection();
  const { id } = await props.params;
  const { submitted } = await props.searchParams;

  const mod = await prisma.module.findUnique({
    where: { id },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!mod) notFound();

  const objectives = mod.learningObjectives?.split("\n").filter(Boolean) ?? [];

  const scriptLink = await prisma.documentLink.findFirst({
    where: { moduleId: id, type: "script" },
    orderBy: { addedAt: "desc" },
  });
  let script: ScriptInfo | null = null;
  if (scriptLink) {
    // Live "last edited" info from Drive, when this viewer's token can see the file.
    const session = await auth();
    const meta =
      scriptLink.driveFileId && session?.user?.id && session.driveGranted
        ? await getGoogleAccessToken(session.user.id)
            .then((token) => getFileMeta(token, scriptLink.driveFileId!))
            .catch(() => null)
        : null;
    script = {
      id: scriptLink.id,
      url: scriptLink.url,
      label: meta?.name ?? scriptLink.label,
      lastEdited: meta?.modifiedTime ?? null,
      lastEditedBy: meta?.lastModifyingUser?.displayName ?? null,
    };
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      {submitted && (
        <div
          role="status"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          Discovery Form submitted. The module has been created.
        </div>
      )}

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

      <Section title="Script">
        <ScriptPanel moduleId={mod.id} script={script} />
      </Section>

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
