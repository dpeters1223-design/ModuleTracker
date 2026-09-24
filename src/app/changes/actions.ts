"use server";

import { changed } from "@/lib/changed";
import type { ChangeOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CHANGE_ORDER_STATUS_LABELS } from "@/lib/labels";
import { logActivity } from "@/lib/activity";

const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

export type ChangeOrderInput = {
  /** "" = applies to all modules */
  moduleId: string;
  description: string;
  sceneRef: string;
  status: string;
  suggestedBy: string;
  suggestedDate: string; // "YYYY-MM-DD" or ""
  goalDate: string;
  approvedBy: string;
  completedDate: string;
  versionUpdated: boolean;
  notes: string;
};

export type ChangeOrderResult = { errors?: string[] };

async function validate(input: ChangeOrderInput) {
  const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const d = {
    moduleId: t(input.moduleId),
    description: t(input.description),
    sceneRef: t(input.sceneRef),
    status: t(input.status),
    suggestedBy: t(input.suggestedBy),
    suggestedDate: t(input.suggestedDate),
    goalDate: t(input.goalDate),
    approvedBy: t(input.approvedBy),
    completedDate: t(input.completedDate),
    notes: t(input.notes),
  };
  const errors: string[] = [];
  if (!d.description) errors.push("Describe the change.");
  if (!(d.status in CHANGE_ORDER_STATUS_LABELS)) errors.push("Pick a status.");
  if (
    d.description.length > 2000 ||
    d.notes.length > 5000 ||
    [d.sceneRef, d.suggestedBy, d.approvedBy].some((s) => s.length > 200)
  ) {
    errors.push("Some entries are too long.");
  }
  for (const date of [d.suggestedDate, d.goalDate, d.completedDate]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)))) {
      errors.push("Dates must be valid dates.");
      break;
    }
  }
  if (d.moduleId && !(await prisma.module.findUnique({ where: { id: d.moduleId }, select: { id: true } }))) {
    errors.push("That module no longer exists.");
  }

  // Calendar days: noon UTC so no timezone shifts them.
  const day = (s: string) => (s ? new Date(`${s}T12:00:00Z`) : null);
  return {
    errors,
    fields: {
      moduleId: d.moduleId || null,
      description: d.description,
      sceneRef: d.sceneRef || null,
      status: d.status as ChangeOrderStatus,
      suggestedBy: d.suggestedBy || null,
      suggestedDate: day(d.suggestedDate),
      goalDate: day(d.goalDate),
      approvedBy: d.approvedBy || null,
      completedDate: day(d.completedDate),
      versionUpdated: Boolean(input.versionUpdated),
      notes: d.notes || null,
    },
  };
}

export async function createChangeOrder(input: ChangeOrderInput): Promise<ChangeOrderResult> {
  const user = await requireUser();
  const { errors, fields } = await validate(input);
  if (errors.length) return { errors };
  const co = await prisma.changeOrder.create({ data: fields });
  await logActivity(user, {
    action: "changeorder.create",
    summary: `Added change order "${short(co.description)}"${co.moduleId ? "" : " (all modules)"}`,
    entityType: "changeOrder",
    entityId: co.id,
    moduleId: co.moduleId,
    after: co,
  });
  changed();
  return {};
}

export async function updateChangeOrder(id: string, input: ChangeOrderInput): Promise<ChangeOrderResult> {
  const user = await requireUser();
  const { errors, fields } = await validate(input);
  if (errors.length) return { errors };
  const before = await prisma.changeOrder.findUnique({ where: { id } });
  if (!before) return { errors: ["That change order no longer exists."] };
  const after = await prisma.changeOrder.update({ where: { id }, data: fields });
  await logActivity(user, {
    action: "changeorder.update",
    summary: `Edited change order "${short(after.description)}"`,
    entityType: "changeOrder",
    entityId: id,
    moduleId: after.moduleId ?? before.moduleId,
    before,
    after,
  });
  changed();
  return {};
}

export async function setChangeOrderStatus(id: string, status: string): Promise<ChangeOrderResult> {
  const user = await requireUser();
  if (!(status in CHANGE_ORDER_STATUS_LABELS)) return { errors: ["Unknown status."] };
  const before = await prisma.changeOrder.findUnique({ where: { id } });
  if (!before) return { errors: ["That change order no longer exists."] };
  const after = await prisma.changeOrder.update({ where: { id }, data: { status: status as ChangeOrderStatus } });
  await logActivity(user, {
    action: "changeorder.status",
    summary: `Marked change order "${short(after.description)}" ${CHANGE_ORDER_STATUS_LABELS[after.status]}`,
    entityType: "changeOrder",
    entityId: id,
    moduleId: after.moduleId,
    before,
    after,
  });
  changed();
  return {};
}

export async function deleteChangeOrder(id: string): Promise<ChangeOrderResult> {
  const user = await requireUser();
  const co = await prisma.changeOrder.findUnique({ where: { id } });
  if (!co) return {};
  await prisma.changeOrder.delete({ where: { id } });
  await logActivity(user, {
    action: "changeorder.delete",
    summary: `Deleted change order "${short(co.description)}"`,
    entityType: "changeOrder",
    entityId: id,
    moduleId: co.moduleId,
    before: co,
  });
  changed();
  return {};
}
