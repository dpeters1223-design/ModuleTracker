"use server";

import { after } from "next/server";
import type { FeatureRequestStatus } from "@prisma/client";
import { changed } from "@/lib/changed";
import { emailList, logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { FEATURE_REQUEST_STATUS_LABELS } from "@/lib/labels";
import { getOrCreateDirectChannel } from "@/lib/chat";
import { appUrl, postToSlackLater, slackEscape, slackMention } from "@/lib/slack";

export type FeatureRequestResult = { errors?: string[]; id?: string };

const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

export type FeatureRequestLinks = {
  moduleId?: string | null;
  taskId?: string | null;
  mediaItemId?: string | null;
  documentLinkId?: string | null;
};

/**
 * Tells NOTIFY_USERS a new request came in — David expected this to already exist
 * (it didn't; neither Change Orders notify anyone), via the same "DM in-app always,
 * Slack when they have a SLACK_USER_IDS entry" channel as @mentions (src/lib/mentions.ts).
 */
async function notifyNewFeatureRequest(from: { id: string; name: string }, title: string) {
  const recipients = emailList(process.env.NOTIFY_USERS);
  if (!recipients.length) return;
  const users = await prisma.user.findMany({ where: { email: { in: recipients } }, select: { id: true, email: true } });
  const others = users.filter((u) => u.id !== from.id);
  if (!others.length) return;
  const link = appUrl("/requests");

  const toSlack = others.map((u) => slackMention(u.email)).filter((m): m is string => Boolean(m));
  if (toSlack.length) {
    postToSlackLater(async () =>
      `:bulb: *${slackEscape(from.name)}* submitted a feature request — ${toSlack.join(" ")}\n` +
      `> ${slackEscape(short(title))}\n` +
      `<${link}|Open it>`
    );
  }

  after(async () => {
    for (const u of others) {
      try {
        const channel = await getOrCreateDirectChannel(from.id, u.id);
        await prisma.chatMessage.create({
          data: { channelId: channel.id, authorId: from.id, body: `New feature request: "${title}"\n${link}` },
        });
      } catch (e) {
        console.error("[feature-requests] in-app DM failed:", e instanceof Error ? e.message : e);
      }
    }
  });
}

/** Anyone signed in can submit — this is the place Jay's ideas go instead of Slack. */
export async function createFeatureRequest(title: string, body: string, links: FeatureRequestLinks = {}): Promise<FeatureRequestResult> {
  const user = await requireUser();
  const t = title.trim();
  const b = body.trim();
  if (!t) return { errors: ["Give it a title."] };
  if (t.length > 200) return { errors: ["Title's too long."] };
  if (b.length > 5000) return { errors: ["That's too long."] };

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const request = await prisma.featureRequest.create({
    data: {
      title: t,
      body: b || null,
      submittedById: user.id,
      submittedByName: me?.name ?? user.email,
      moduleId: links.moduleId || null,
      taskId: links.taskId || null,
      mediaItemId: links.mediaItemId || null,
      documentLinkId: links.documentLinkId || null,
    },
  });
  await logActivity(user, {
    action: "featureRequest.create",
    summary: `Submitted feature request "${short(t)}"`,
    entityType: "featureRequest",
    entityId: request.id,
    after: request,
  });
  await notifyNewFeatureRequest({ id: user.id, name: me?.name ?? user.email }, t);
  changed();
  return { id: request.id };
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
