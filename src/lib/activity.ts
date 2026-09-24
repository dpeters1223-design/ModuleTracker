import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moduleTitle } from "@/lib/script-template";

// Change history. Every data change records who did what, and a before/after copy
// so it can be undone. Undo kinds come from the action name:
//   *.create / *.add / *.start / *.import / *.link  → undo deletes what was made
//   *.delete / *.remove / *.unlink                  → undo recreates it from `before`
//   anything else (edit, status, phase…)            → undo restores `before`
// plus two whole-module specials: discovery.update and module.delete.

type Actor = { id: string; email: string };

type EntityType = "task" | "documentLink" | "moduleVersion" | "changeOrder" | "module";

export type LogInput = {
  action: string;
  summary: string;
  entityType: EntityType;
  entityId?: string | null;
  moduleId?: string | null;
  /** Needed only when the module no longer exists (e.g. it was just deleted). */
  moduleLabel?: string | null;
  before?: unknown;
  after?: unknown;
};

/** Plain JSON copy (Dates become ISO strings; Prisma accepts those back). */
const json = (v: unknown) =>
  v === undefined || v === null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

export async function logActivity(actor: Actor, input: LogInput) {
  const [user, mod] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } }),
    input.moduleId && !input.moduleLabel
      ? prisma.module.findUnique({ where: { id: input.moduleId }, select: { number: true, name: true } })
      : null,
  ]);
  await prisma.activityLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: user?.name ?? null,
      action: input.action,
      summary: input.summary,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      moduleId: input.moduleId ?? null,
      moduleLabel: input.moduleLabel ?? (mod ? moduleTitle(mod) : null),
      before: json(input.before),
      after: json(input.after),
    },
  });
}

type UndoKind = "create" | "delete" | "update" | "discovery" | "moduleDelete" | "none";

export function undoKind(action: string): UndoKind {
  if (action === "undo") return "none";
  if (action === "discovery.update") return "discovery";
  if (action === "module.delete") return "moduleDelete";
  const verb = action.split(".").pop()!;
  if (["create", "add", "start", "import", "link"].includes(verb)) return "create";
  if (["delete", "remove", "unlink"].includes(verb)) return "delete";
  return "update";
}

type Row = Record<string, unknown> & { id: string };

/** The Prisma model for an entity type, loosely typed for generic undo. */
function model(tx: Prisma.TransactionClient, type: string) {
  const m = {
    task: tx.task,
    documentLink: tx.documentLink,
    moduleVersion: tx.moduleVersion,
    changeOrder: tx.changeOrder,
    module: tx.module,
  }[type];
  if (!m) throw new Error(`Can't undo changes to ${type}.`);
  return m as unknown as {
    findUnique(a: object): Promise<unknown>;
    create(a: object): Promise<unknown>;
    update(a: object): Promise<unknown>;
    deleteMany(a: object): Promise<{ count: number }>;
    createMany(a: object): Promise<unknown>;
  };
}

/** Recreate a document link, dropping its `addedById` if that user is gone. */
async function recreateLinks(tx: Prisma.TransactionClient, links: Row[]) {
  if (!links.length) return;
  const users = new Set((await tx.user.findMany({ select: { id: true } })).map((u) => u.id));
  await tx.documentLink.createMany({
    data: links.map((l) => ({ ...l, addedById: users.has(l.addedById as string) ? l.addedById : null })) as never,
  });
}

/**
 * Reverses one logged change and records the undo. Returns an error message
 * (for the person clicking Undo) instead of throwing when it can't be undone.
 */
export async function undoActivity(actor: Actor, id: string): Promise<{ error?: string }> {
  const entry = await prisma.activityLog.findUnique({ where: { id } });
  if (!entry) return { error: "That change isn't in the history anymore." };
  if (entry.undoneAt) return { error: "That change was already undone." };
  const kind = undoKind(entry.action);
  if (kind === "none") return { error: "An undo can't itself be undone." };

  const before = entry.before as Row | null;
  const after = entry.after as Row | null;
  try {
    await prisma.$transaction(async (tx) => {
      const m = model(tx, entry.entityType);
      if (kind === "create") {
        await m.deleteMany({ where: { id: after?.id ?? entry.entityId } });
      } else if (kind === "delete") {
        if (!before) throw new Error("No saved copy to restore.");
        if (entry.entityType === "documentLink") await recreateLinks(tx, [before]);
        else await m.create({ data: before });
      } else if (kind === "update") {
        if (!before) throw new Error("No saved copy to restore.");
        const { id: rowId, ...fields } = before;
        if (!(await m.findUnique({ where: { id: rowId ?? entry.entityId } }))) {
          throw new Error("It has been deleted since, so there's nothing to change back.");
        }
        await m.update({ where: { id: rowId ?? entry.entityId }, data: fields });
      } else if (kind === "discovery") {
        const { module: modBefore, scenes } = before as unknown as { module: Row; scenes: Row[] };
        const { id: modId, ...modFields } = modBefore;
        if (!(await tx.module.findUnique({ where: { id: modId } }))) {
          throw new Error("The module has been deleted since.");
        }
        await tx.module.update({ where: { id: modId }, data: modFields as never });
        await tx.scene.deleteMany({ where: { moduleId: modId, id: { notIn: scenes.map((s) => s.id) } } });
        for (const s of scenes) {
          const { id: sceneId, ...sceneFields } = s;
          await tx.scene.upsert({ where: { id: sceneId }, create: s as never, update: sceneFields as never });
        }
      } else if (kind === "moduleDelete") {
        const t = before as unknown as {
          module: Row;
          scenes: Row[];
          tasks: Row[];
          documentLinks: Row[];
          versions: Row[];
          changeOrders: Row[];
        };
        await tx.module.create({ data: t.module as never });
        if (t.scenes.length) await tx.scene.createMany({ data: t.scenes as never });
        if (t.tasks.length) await tx.task.createMany({ data: t.tasks as never });
        if (t.versions.length) await tx.moduleVersion.createMany({ data: t.versions as never });
        if (t.changeOrders.length) await tx.changeOrder.createMany({ data: t.changeOrders as never });
        await recreateLinks(tx, t.documentLinks);
      }
      await tx.activityLog.update({ where: { id }, data: { undoneAt: new Date(), undoneBy: actor.email } });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: /Unique constraint/i.test(msg) ? "It already exists again, so there's nothing to restore." : msg };
  }

  await logActivity(actor, {
    action: "undo",
    summary: `Undid: ${entry.summary}`,
    entityType: entry.entityType as EntityType,
    entityId: entry.entityId,
    moduleId: entry.moduleId,
    moduleLabel: entry.moduleLabel,
  });
  return {};
}

/** Emails from a comma-separated env var, lowercased. */
export const emailList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
