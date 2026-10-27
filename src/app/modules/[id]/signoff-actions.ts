"use server";

import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canSignOff } from "@/lib/signoff";
import { moduleTitle } from "@/lib/script-template";
import { appUrl, postToSlackLater, slackEscape } from "@/lib/slack";

export type SignOffResult = { error?: string };

/**
 * Marks a module formally signed off. This is a status change, not an archive: the
 * module stays fully editable afterwards, and changes made after sign-off are what
 * the change-order list is for.
 */
export async function signOffModule(moduleId: string): Promise<SignOffResult> {
  const user = await requireUser();
  if (!canSignOff(user.email)) return { error: "Only the people who sign off on modules can do this." };

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, number: true, name: true, status: true, signedOffAt: true },
  });
  if (!mod) return { error: "That module no longer exists." };
  if (mod.signedOffAt) return { error: "That module is already signed off." };

  const after = await prisma.module.update({
    where: { id: moduleId },
    data: { signedOffAt: new Date(), signedOffById: user.id, status: "signed_off" },
  });

  await logActivity(user, {
    action: "module.signoff",
    summary: `Signed off "${moduleTitle(mod)}"`,
    entityType: "module",
    entityId: moduleId,
    moduleId,
    before: { status: mod.status, signedOffAt: null, signedOffById: null },
    after: { status: after.status, signedOffAt: after.signedOffAt, signedOffById: after.signedOffById },
    slack: false,
  });
  postToSlackLater(
    async () =>
      `:white_check_mark: *${slackEscape(moduleTitle(mod))}* has been signed off by ${slackEscape(user.email)} · ` +
      `<${appUrl(`/modules/${moduleId}`)}|Open the module>`
  );
  changed();
  return {};
}

/** Undoes a sign-off, for when it was clicked too early. */
export async function reopenModule(moduleId: string): Promise<SignOffResult> {
  const user = await requireUser();
  if (!canSignOff(user.email)) return { error: "Only the people who sign off on modules can do this." };

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, number: true, name: true, status: true, signedOffAt: true, signedOffById: true },
  });
  if (!mod?.signedOffAt) return { error: "That module isn't signed off." };

  await prisma.module.update({
    where: { id: moduleId },
    data: { signedOffAt: null, signedOffById: null },
  });
  await logActivity(user, {
    action: "module.signoff.undo",
    summary: `Reopened "${moduleTitle(mod)}" after sign-off`,
    entityType: "module",
    entityId: moduleId,
    moduleId,
    before: { signedOffAt: mod.signedOffAt, signedOffById: mod.signedOffById },
    after: { signedOffAt: null, signedOffById: null },
  });
  changed();
  return {};
}
