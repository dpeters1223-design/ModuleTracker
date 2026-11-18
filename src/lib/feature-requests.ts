import { prisma } from "@/lib/prisma";
import { moduleTitle } from "@/lib/script-template";
import type { FeatureRequestRow } from "@/components/feature-request-list";

/** Feature requests as rows, newest first, with whatever they're tagged to. */
export async function getFeatureRequestRows(): Promise<FeatureRequestRow[]> {
  const rows = await prisma.featureRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      module: { select: { id: true, number: true, name: true } },
      task: { select: { id: true, title: true, moduleId: true } },
      mediaItem: { select: { id: true, name: true } },
      documentLink: { select: { id: true, label: true, type: true, moduleId: true } },
      attachments: { select: { id: true, name: true, mimeType: true }, orderBy: { addedAt: "asc" } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body ?? "",
    status: r.status,
    submittedByName: r.submittedByName,
    createdAt: r.createdAt.toISOString().slice(0, 10),
    module: r.module ? { id: r.module.id, label: moduleTitle(r.module) } : null,
    task: r.task ? { id: r.task.id, moduleId: r.task.moduleId, label: r.task.title } : null,
    mediaItem: r.mediaItem ? { id: r.mediaItem.id, label: r.mediaItem.name } : null,
    documentLink: r.documentLink
      ? { id: r.documentLink.id, moduleId: r.documentLink.moduleId, label: r.documentLink.label ?? (r.documentLink.type === "script" ? "Script" : "Script draft") }
      : null,
    attachments: r.attachments,
  }));
}

/** Every task, labeled with its module — for the "tag a task" picker. */
export async function getTaskOptions() {
  const tasks = await prisma.task.findMany({
    select: { id: true, title: true, module: { select: { number: true, name: true } } },
    orderBy: [{ module: { createdAt: "desc" } }, { order: "asc" }],
  });
  return tasks.map((t) => ({ id: t.id, label: `${moduleTitle(t.module)} — ${t.title}` }));
}

/** Every media item, for the "tag a piece of media" picker. */
export async function getMediaItemOptions() {
  const items = await prisma.mediaItem.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map((m) => ({ id: m.id, label: m.name }));
}

/** Every script or script draft, for the "tag a script" picker. */
export async function getDocumentLinkOptions() {
  const links = await prisma.documentLink.findMany({
    where: { type: { in: ["script", "script_draft"] } },
    select: { id: true, label: true, type: true, module: { select: { number: true, name: true } } },
    orderBy: { addedAt: "desc" },
  });
  return links.map((l) => ({
    id: l.id,
    label: `${moduleTitle(l.module)} — ${l.label ?? (l.type === "script" ? "Script" : "Script draft")}`,
  }));
}
