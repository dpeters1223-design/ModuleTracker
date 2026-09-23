import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import { getScript } from "@/lib/scripts";
import { prisma } from "@/lib/prisma";
import { ModuleStatusSelect } from "@/components/module-status-select";
import { TaskList, type TaskRow } from "./task-list";
import { ModuleTaskBoard } from "@/components/module-task-board";
import { DocumentList, type DocumentRow } from "./document-list";

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
  const { submitted, saved, tasks: tasksView } = await props.searchParams;
  const taskBoard = tasksView === "board";
  const mod = await getModule(id);
  if (!mod) notFound();

  const objectives = mod.learningObjectives?.split("\n").filter(Boolean) ?? [];
  const script = await getScript(mod.id);

  const [taskRecords, ownerRows, documentRecords] = await Promise.all([
    prisma.task.findMany({ where: { moduleId: mod.id }, orderBy: [{ dueDate: "asc" }, { order: "asc" }] }),
    prisma.task.findMany({
      where: { owner: { not: null } },
      distinct: ["owner"],
      select: { owner: true },
      orderBy: { owner: "asc" },
    }),
    prisma.documentLink.findMany({
      where: { moduleId: mod.id, type: { not: "script" } },
      include: { addedBy: { select: { name: true, email: true } } },
      orderBy: { addedAt: "asc" },
    }),
  ]);
  const documents: DocumentRow[] = documentRecords.map((d) => ({
    id: d.id,
    type: d.type,
    label: d.label,
    url: d.url,
    addedBy: d.addedBy?.name ?? d.addedBy?.email ?? null,
  }));
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const tasks: TaskRow[] = taskRecords.map((t) => ({
    id: t.id,
    title: t.title,
    phase: t.phase,
    owner: t.owner ?? "",
    status: t.status,
    startDate: day(t.startDate),
    dueDate: day(t.dueDate),
    notes: t.notes ?? "",
  }));
  const owners = ownerRows.map((o) => o.owner!).filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);

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
      {saved && (
        <div
          role="status"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          Changes saved.
        </div>
      )}

      <header className="space-y-2">
        <Link
          href="/modules"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All modules
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mod.number && <span className="text-zinc-500">{mod.number} · </span>}
            {mod.name}
          </h1>
          <Link
            href={`/modules/${mod.id}/edit`}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <ModuleStatusSelect moduleId={mod.id} status={mod.status} />
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Tasks & timeline</h2>
          <nav className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900" aria-label="Task view">
            {(
              [
                ["List", `/modules/${mod.id}`, !taskBoard],
                ["Board", `/modules/${mod.id}?tasks=board`, taskBoard],
              ] as const
            ).map(([label, href, active]) => (
              <Link
                key={label}
                href={href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  active
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <TaskList moduleId={mod.id} tasks={tasks} owners={owners} today={today} addOnly={taskBoard} />
        {taskBoard && <ModuleTaskBoard module={mod} tasks={taskRecords} today={today} />}
      </section>

      <Section title="Documents">
        <DocumentList moduleId={mod.id} documents={documents} />
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
