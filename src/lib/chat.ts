import "server-only";
import { prisma } from "@/lib/prisma";
import { isAllowedEmail } from "@/lib/allowlist";
import { dayInZone, timeInZone } from "@/lib/dates";

/** Fixed id so every request upserts the same row instead of racing to create it. */
export const TEAM_CHANNEL_ID = "team-channel";

export type NotifyLevel = "all" | "mentions" | "none";

export type ChannelSummary = {
  id: string;
  kind: "team" | "group";
  /** Display name: the channel's own name, the other member's name for a 2-person DM, else a member list. */
  label: string;
  lastReadAt: Date | null;
  /** This channel's own setting, or null when it follows the person's default. */
  notifyOverride: NotifyLevel | null;
  /** What actually applies, once the person's default is taken into account. */
  notify: NotifyLevel;
};

/** How a person appears in chat, after their own settings are applied. */
export type ChatAuthor = {
  id: string;
  email: string;
  /** Their chat nickname, else their Google account name, else their email. */
  name: string;
  /** A chosen emoji avatar, if they set one. */
  emoji: string | null;
  /** Their Google photo, unless they turned it off. */
  image: string | null;
};

export type MessageRow = {
  id: string;
  body: string;
  /** Kept for the poll cursor; day/time are what the UI renders. */
  createdAt: Date;
  /** "YYYY-MM-DD" in the team's time zone, for grouping into days. */
  day: string;
  /** e.g. "2:14 PM". Formatted here because dates.ts is server-only, and because
   *  formatting in the browser would disagree with the server's first render. */
  time: string;
  author: ChatAuthor | null;
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  chatProfile: { nickname: string | null; emoji: string | null; useGooglePhoto: boolean } | null;
};

type MessageRecord = { id: string; body: string; createdAt: Date; author: UserRecord | null };

/** The person's settings applied: nickname over Google name, emoji over photo. */
export const toChatAuthor = (u: UserRecord): ChatAuthor => ({
  id: u.id,
  email: u.email,
  name: u.chatProfile?.nickname?.trim() || u.name || u.email,
  emoji: u.chatProfile?.emoji ?? null,
  image: u.chatProfile?.useGooglePhoto === false ? null : u.image,
});

export const toMessageRow = (m: MessageRecord): MessageRow => ({
  id: m.id,
  body: m.body,
  createdAt: m.createdAt,
  day: dayInZone(m.createdAt),
  time: timeInZone(m.createdAt),
  author: m.author ? toChatAuthor(m.author) : null,
});

/** The always-on team channel, created on first use. */
export async function getOrCreateTeamChannel() {
  return prisma.chatChannel.upsert({
    where: { id: TEAM_CHANNEL_ID },
    create: { id: TEAM_CHANNEL_ID, kind: "team", name: "Team" },
    update: {},
  });
}

/** What the chat settings panel shows: the person's choices plus the Google defaults behind them. */
export type ChatProfileSettings = {
  nickname: string;
  emoji: string | null;
  useGooglePhoto: boolean;
  notifyLevel: NotifyLevel;
  /** Shown as the placeholder, so someone can see what they'd be called by default. */
  googleName: string | null;
  hasGooglePhoto: boolean;
};

export async function getChatProfile(userId: string): Promise<ChatProfileSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true, chatProfile: true },
  });
  const p = user?.chatProfile;
  return {
    nickname: p?.nickname ?? "",
    emoji: p?.emoji ?? null,
    useGooglePhoto: p?.useGooglePhoto ?? true,
    notifyLevel: p?.notifyLevel ?? "all",
    googleName: user?.name ?? null,
    hasGooglePhoto: Boolean(user?.image),
  };
}

/** Allowlisted users who have signed in at least once (User rows are created at sign-in). */
export async function listAllowedUsers(): Promise<{ id: string; email: string; name: string | null }[]> {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  return users.filter((u) => isAllowedEmail(u.email));
}

/**
 * The one place channel membership is checked. No-op for the team channel —
 * any caller already passed requireUser() — otherwise requires a membership row.
 */
export async function requireChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error("That channel no longer exists.");
  if (channel.kind === "team") return channel;
  const member = await prisma.chatChannelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (!member) throw new Error("You're not a member of that channel.");
  return channel;
}

/** Every channel this user can see: the team channel, plus their groups/DMs. */
export async function listChannelsForUser(userId: string): Promise<ChannelSummary[]> {
  const [team, memberships, profile] = await Promise.all([
    getOrCreateTeamChannel(),
    prisma.chatChannelMember.findMany({
      where: { userId },
      include: {
        channel: { include: { members: { include: { user: { select: authorSelect } } } } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.chatProfile.findUnique({ where: { userId }, select: { notifyLevel: true } }),
  ]);
  const fallback: NotifyLevel = profile?.notifyLevel ?? "all";
  const teamMembership = memberships.find((m) => m.channelId === team.id);

  const groups: ChannelSummary[] = memberships
    .filter((m) => m.channel.kind === "group")
    .map((m) => {
      const others = m.channel.members.map((mem) => toChatAuthor(mem.user)).filter((u) => u.id !== userId);
      const label = m.channel.name ?? others.map((u) => u.name).join(", ") ?? "";
      return {
        id: m.channel.id,
        kind: "group",
        label,
        lastReadAt: m.lastReadAt,
        notifyOverride: m.notifyLevel,
        notify: m.notifyLevel ?? fallback,
      };
    });

  return [
    {
      id: team.id,
      kind: "team",
      label: "Team",
      lastReadAt: teamMembership?.lastReadAt ?? null,
      notifyOverride: teamMembership?.notifyLevel ?? null,
      notify: teamMembership?.notifyLevel ?? fallback,
    },
    ...groups,
  ];
}

/**
 * Unread counts per channel (messages by someone else, newer than lastReadAt), in
 * one query. Muted channels are left out — "mentions" counts as muted until
 * @-mentions exist to count.
 */
export async function unreadChatCounts(
  userId: string,
  channels: ChannelSummary[]
): Promise<{ byChannel: Record<string, number>; total: number }> {
  const counted = channels.filter((c) => c.notify === "all");
  if (!counted.length) return { byChannel: {}, total: 0 };
  const rows = await prisma.chatMessage.groupBy({
    by: ["channelId"],
    where: {
      authorId: { not: userId },
      OR: counted.map((c) => ({ channelId: c.id, createdAt: { gt: c.lastReadAt ?? new Date(0) } })),
    },
    _count: true,
  });
  const byChannel = Object.fromEntries(rows.map((r) => [r.channelId, r._count]));
  return { byChannel, total: rows.reduce((sum, r) => sum + r._count, 0) };
}

const authorSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  chatProfile: { select: { nickname: true, emoji: true, useGooglePhoto: true } },
} as const;

export const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: authorSelect },
} as const;

/** Cursor-filtered for polling ("newer than `after`"); the last 50 for an initial load. */
export async function listMessagesForChannel(channelId: string, after?: Date): Promise<MessageRow[]> {
  if (after) {
    const rows = await prisma.chatMessage.findMany({
      where: { channelId, createdAt: { gt: after } },
      orderBy: { createdAt: "asc" },
      select: messageSelect,
    });
    return rows.map(toMessageRow);
  }
  const rows = await prisma.chatMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: messageSelect,
  });
  return rows.reverse().map(toMessageRow);
}
