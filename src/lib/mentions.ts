import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateDirectChannel } from "@/lib/chat";
import { postToSlackLater, slackEscape, slackMention } from "@/lib/slack";
import { TEAM, buildOwnerIndex, teamNames } from "@/lib/team";

/** Names to offer in an "@" autocomplete — the roster's full names. */
export const mentionTargets = teamNames;

export type Mentioned = { userId: string; email: string };

/**
 * The people named by "@Full Name" in a comment or note, as actual User rows (not
 * just emails) — notifyMentions needs a real user id to DM them in the app. Reuses
 * the same name matching as the Owner box (src/lib/team.ts), so "@Jay" and
 * "@Jay Williamson" both resolve — but only full-name mentions are turned into
 * clickable-looking tokens by the composer, so in practice this sees the full names
 * it suggested. Someone on the roster who has never signed in has no User row and
 * so can't be @mentioned in the app yet (no account to DM) — left out rather than
 * erroring, since Slack may still reach them via SLACK_USER_IDS.
 */
export async function parseMentions(body: string): Promise<Mentioned[]> {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const index = buildOwnerIndex(users);
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const found = new Map<string, Mentioned>();
  // Longest names first, so "@Tom Pennell" isn't matched as just "@Tom" and left
  // with " Pennell" dangling (harmless either way, but this reads the intent right).
  const names = [...TEAM.map((m) => m.name), ...users.map((u) => u.name ?? "")]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    const re = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!re.test(body)) continue;
    const emails = index.get(name.toLowerCase());
    if (emails?.size !== 1) continue;
    const email = [...emails][0];
    const user = byEmail.get(email);
    if (user) found.set(email, { userId: user.id, email });
  }
  return [...found.values()];
}

/**
 * Pings each mentioned person: on Slack when they have a SLACK_USER_IDS entry, and
 * always with a DM in the app's own chat — since not everyone (e.g. Tom) uses Slack,
 * but everyone here has signed into the app. `from` posts the in-app message as
 * themselves, the same way sending any other chat message does.
 */
export function notifyMentions(mentioned: Mentioned[], from: { id: string; name: string }, excerpt: string, link: string) {
  const others = mentioned.filter((m) => m.userId !== from.id); // mentioning yourself notifies nobody
  if (!others.length) return;
  const flat = excerpt.replace(/\s+/g, " ").trim();
  const short = flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;

  const toSlack = others.map((m) => slackMention(m.email)).filter((m): m is string => Boolean(m));
  if (toSlack.length) {
    postToSlackLater(async () =>
      `${toSlack.join(" ")} — *${slackEscape(from.name)}* mentioned you:\n` +
      `> ${slackEscape(short)}\n` +
      `<${link}|Open it>`
    );
  }

  after(async () => {
    for (const m of others) {
      try {
        const channel = await getOrCreateDirectChannel(from.id, m.userId);
        await prisma.chatMessage.create({
          data: { channelId: channel.id, authorId: from.id, body: `${short}\n${link}` },
        });
      } catch (e) {
        console.error("[mentions] in-app DM failed:", e instanceof Error ? e.message : e);
      }
    }
  });
}
