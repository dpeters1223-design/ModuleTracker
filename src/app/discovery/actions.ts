"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ModuleStatus, TaskPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanDiscovery, type DiscoveryInput, type DiscoveryScene } from "@/lib/discovery";
import { MODULE_STATUS_LABELS, TASK_PHASE_LABELS } from "@/lib/labels";
import { requireUser } from "@/lib/session";

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
  };
}

export async function submitDiscovery(input: DiscoveryInput): Promise<DiscoveryResult> {
  await requireUser();
  const { data, errors } = cleanDiscovery(input);
  if (errors.length) return { errors };

  const mod = await prisma.module.create({
    data: {
      ...moduleFields(data),
      status: "pre_production",
      scenes: { create: data.scenes.map(sceneFields) },
    },
    select: { id: true },
  });

  revalidatePath("/", "layout");
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
  await requireUser();
  const { data, errors } = cleanDiscovery(input);
  if (errors.length) return { errors };

  const existing = await prisma.scene.findMany({ where: { moduleId }, select: { id: true } });
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

  revalidatePath("/", "layout");
  redirect(`/modules/${moduleId}?saved=1`);
}

// Which task phase each production status corresponds to. Moving a module to a
// status means every task in the phases before it should be done.
const STATUS_PHASE: Partial<Record<ModuleStatus, TaskPhase>> = {
  pre_production: "pre_production",
  scripting: "scripting",
  production: "production",
  post_production: "post_production",
  building: "build",
  playtesting: "playtesting",
  signed_off: "sign_off",
  deployed: "deployment",
};
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
  await requireUser();
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

  await prisma.module.update({ where: { id: moduleId }, data: { status: status as ModuleStatus } });
  revalidatePath("/", "layout");
  return { errors: [] };
}

/**
 * Deletes the module; its scenes, tasks, links and change orders cascade. The
 * Drive folder and script document are left in Google Drive.
 */
export async function deleteModule(moduleId: string): Promise<DiscoveryResult> {
  await requireUser();
  await prisma.module.delete({ where: { id: moduleId } });
  revalidatePath("/", "layout");
  redirect("/modules?deleted=1");
}
