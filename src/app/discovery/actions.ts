"use server";

import { changed } from "@/lib/changed";
import { redirect } from "next/navigation";
import type { ModuleStatus, TaskPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moduleTitle } from "@/lib/script-template";
import { cleanDiscovery, type DiscoveryInput, type DiscoveryScene } from "@/lib/discovery";
import { MODULE_STATUS_LABELS, STATUS_PHASE, TASK_PHASE_LABELS } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";

// The Module columns the Discovery Form owns (what an edit can change and undo restores).
const DISCOVERY_KEYS = [
  "name", "number", "description", "audience", "targetCompletion",
  "runtimeMinutes", "learningObjectives", "toolsUsed", "featuresDiscussed",
] as const;

export type DiscoveryResult = { errors: string[] };

const opt = (s: string) => s || null;

/** Module columns written by the Discovery Form (create and edit share this mapping). */
function moduleFields(data: DiscoveryInput) {
  return {
    name: data.name,
    number: opt(data.number),
    description: data.description,
    audience: opt(data.audience),
    targetCompletion: opt(data.targetCompletion),
    runtimeMinutes: data.runtimeMinutes ? Number(data.runtimeMinutes) : null,
    learningObjectives: opt(data.objectives.join("\n")),
    toolsUsed: opt(data.tools.map((tool) => tool.name).join("\n")),
    // One block per tool ("Tool:\nfeatures"), readable as-is in Prisma Studio
    featuresDiscussed: opt(
      data.tools
        .filter((tool) => tool.features)
        .map((tool) => `${tool.name}:\n${tool.features}`)
        .join("\n\n")
    ),
  };
}

function sceneFields(s: DiscoveryScene, i: number) {
  return {
    order: i + 1,
    title: opt(s.title),
    location: opt(s.location),
    backgroundMediaType: opt(s.mediaType),
    speaker: opt(s.speaker),
    toolUsed: opt(s.tool),
    interactionHighlighted: opt(s.interaction),
    activities: opt(s.activities),
    notes: opt(s.notes),
    description: opt(s.description),
    talent: opt(s.talent),
    learningObjectives: opt(s.learningObjectives),
    mediaAssets: opt(s.mediaAssets),
  };
}

export async function submitDiscovery(input: DiscoveryInput): Promise<DiscoveryResult> {
  const user = await requireUser();
  const { data, errors } = cleanDiscovery(input);
  if (errors.length) return { errors };

  const mod = await prisma.module.create({
    data: {
      ...moduleFields(data),
      status: "pre_production",
      scenes: { create: data.scenes.map(sceneFields) },
    },
    select: { id: true, number: true, name: true },
  });

  await logActivity(user, {
    action: "discovery.create",
    summary: `Created module from the Discovery Form (${data.scenes.length} scene${data.scenes.length === 1 ? "" : "s"})`,
    entityType: "module",
    entityId: mod.id,
    moduleId: mod.id,
    after: { id: mod.id },
  });
  changed();
  redirect(`/modules/${mod.id}?submitted=1`);
}

/**
 * Saves edited Discovery answers. Scenes are matched by id: existing ones are
 * updated (keeping anything linked to them), new ones created, and scenes
 * removed in the form are deleted.
 */
export async function updateDiscovery(
  moduleId: string,
  input: DiscoveryInput
): Promise<DiscoveryResult> {
  const user = await requireUser();
  const { data, errors } = cleanDiscovery(input);
  if (errors.length) return { errors };

  const modBefore = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  const existing = await prisma.scene.findMany({ where: { moduleId }, orderBy: { order: "asc" } });
  const existingIds = new Set(existing.map((s) => s.id));
  const keptIds = new Set(data.scenes.map((s) => s.id).filter((id) => id && existingIds.has(id)));

  await prisma.$transaction([
    prisma.module.update({ where: { id: moduleId }, data: moduleFields(data) }),
    prisma.scene.deleteMany({ where: { moduleId, id: { notIn: [...keptIds] as string[] } } }),
    ...data.scenes.map((s, i) =>
      s.id && keptIds.has(s.id)
        ? prisma.scene.update({ where: { id: s.id }, data: sceneFields(s, i) })
        : prisma.scene.create({ data: { moduleId, ...sceneFields(s, i) } })
    ),
  ]);

  const removed = existing.length - keptIds.size;
  const added = data.scenes.length - keptIds.size;
  await logActivity(user, {
    action: "discovery.update",
    summary:
      "Edited Discovery answers" +
      (added || removed ? ` (${[added && `${added} scene${added === 1 ? "" : "s"} added`, removed && `${removed} removed`].filter(Boolean).join(", ")})` : ""),
    entityType: "module",
    entityId: moduleId,
    moduleId,
    before: {
      module: { id: moduleId, ...Object.fromEntries(DISCOVERY_KEYS.map((k) => [k, modBefore[k]])) },
      scenes: existing,
    },
  });
  changed();
  redirect(`/modules/${moduleId}?saved=1`);
}

// Moving a module to a status means every task in the phases before that
// status's phase (STATUS_PHASE) should be done.
const PHASE_ORDER = Object.keys(TASK_PHASE_LABELS) as TaskPhase[];

/**
 * Changes a module's status. Moving it forward checks the prerequisites: if tasks
 * in earlier phases aren't done, it returns a `warning` instead of saving, and the
 * caller can confirm and retry with `force` (a soft gate, not a hard block).
 */
export async function setModuleStatus(
  moduleId: string,
  status: string,
  force = false
): Promise<DiscoveryResult & { warning?: string }> {
  const user = await requireUser();
  if (!(status in MODULE_STATUS_LABELS)) return { errors: ["Unknown status."] };

  const target = STATUS_PHASE[status as ModuleStatus];
  if (target && !force) {
    const earlier = PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(target));
    const open = await prisma.task.findMany({
      where: { moduleId, phase: { in: earlier }, status: { not: "completed" } },
      select: { title: true, phase: true },
      orderBy: { order: "asc" },
    });
    if (open.length) {
      const byPhase = earlier
        .map((p) => ({ p, n: open.filter((t) => t.phase === p).length }))
        .filter((x) => x.n)
        .map((x) => `${x.n} ${TASK_PHASE_LABELS[x.p]}`)
        .join(", ");
      const examples = open.slice(0, 3).map((t) => `• ${t.title}`).join("\n");
      return {
        errors: [],
        warning:
          `Not everything before ${MODULE_STATUS_LABELS[status as ModuleStatus]} is done ` +
          `(${byPhase} task${open.length === 1 ? "" : "s"} still open):\n${examples}` +
          (open.length > 3 ? `\n…and ${open.length - 3} more` : ""),
      };
    }
  }

  const before = await prisma.module.findUniqueOrThrow({ where: { id: moduleId }, select: { id: true, status: true } });
  if (before.status === status) return { errors: [] };
  await prisma.module.update({ where: { id: moduleId }, data: { status: status as ModuleStatus } });
  await logActivity(user, {
    action: "module.status",
    summary:
      `Changed status to ${MODULE_STATUS_LABELS[status as ModuleStatus]} (was ${MODULE_STATUS_LABELS[before.status]})` +
      (force ? " despite open earlier tasks" : ""),
    entityType: "module",
    entityId: moduleId,
    moduleId,
    before,
    after: { id: moduleId, status },
  });
  changed();
  return { errors: [] };
}

/**
 * Deletes the module; its scenes, tasks, links and change orders cascade. The
 * Drive folder and script document are left in Google Drive.
 */
export async function deleteModule(moduleId: string): Promise<DiscoveryResult> {
  const user = await requireUser();
  // Keep a full copy (module + everything that cascades) so the delete can be undone.
  const mod = await prisma.module.findUniqueOrThrow({
    where: { id: moduleId },
    include: { scenes: true, tasks: true, documentLinks: true, versions: true, changeOrders: true },
  });
  const { scenes, tasks, documentLinks, versions, changeOrders, ...moduleRow } = mod;
  await prisma.module.delete({ where: { id: moduleId } });
  await logActivity(user, {
    action: "module.delete",
    summary: `Deleted module (${scenes.length} scenes, ${tasks.length} tasks)`,
    entityType: "module",
    entityId: moduleId,
    moduleId,
    moduleLabel: moduleTitle(moduleRow),
    before: { module: moduleRow, scenes, tasks, documentLinks, versions, changeOrders },
  });
  changed();
  redirect("/modules?deleted=1");
}
