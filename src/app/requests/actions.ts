"use server";

import type { FeatureRequestStatus } from "@prisma/client";
import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { FEATURE_REQUEST_STATUS_LABELS } from "@/lib/labels";

export type FeatureRequestResult = { errors?: string[] };

const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

/** Anyone signed in can submit — this is the place Jay's ideas go instead of Slack. */
export async function createFeatureRequest(title: string, body: string): Promise<FeatureRequestResult> {
  const user = await requireUser();
  const t = title.trim();
  const b = body.trim();
  if (!t) return { errors: ["Give it a title."] };
  if (t.length > 200) return { errors: ["Title's too long."] };
  if (b.length > 5000) return { errors: ["That's too long."] };

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const request = await prisma.featureRequest.create({
    data: { title: t, body: b || null, submittedById: user.id, submittedByName: me?.name ?? user.email },
  });
  await logActivity(user, {
    action: "featureRequest.create",
    summary: `Submitted feature request "${short(t)}"`,
    entityType: "featureRequest",
    entityId: request.id,
    after: request,
  });
  changed();
  return {};
}

export async function setFeatureRequestStatus(id: string, status: string): Promise<FeatureRequestResult> {
  const user = await requireUser();
  if (!(status in FEATURE_REQUEST_STATUS_LABELS)) return { errors: ["Unknown status."] };
  const before = await prisma.featureRequest.findUnique({ where: { id } });
  if (!before) return { errors: ["That request no longer exists."] };
  const after = await prisma.featureRequest.update({ where: { id }, data: { status: status as FeatureRequestStatus } });
  await logActivity(user, {
    action: "featureRequest.status",
    summary: `Marked "${short(after.title)}" ${FEATURE_REQUEST_STATUS_LABELS[after.status]}`,
    entityType: "featureRequest",
    entityId: id,
    before,
    after,
  });
  changed();
  return {};
}

export async function deleteFeatureRequest(id: string): Promise<FeatureRequestResult> {
  const user = await requireUser();
  const request = await prisma.featureRequest.findUnique({ where: { id } });
  if (!request) return {};
  await prisma.featureRequest.delete({ where: { id } });
  await logActivity(user, {
    action: "featureRequest.delete",
    summary: `Deleted feature request "${short(request.title)}"`,
    entityType: "featureRequest",
    entityId: id,
    before: request,
  });
  changed();
  return {};
}
