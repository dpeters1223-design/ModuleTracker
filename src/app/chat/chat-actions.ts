"use server";

import type { ChatReactionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  REACTION_KINDS,
  type ChannelSummary,
  type ChatProfileSettings,
  type MessageRow,
  type NotifyLevel,
  type ReactionSummary,
  getChatProfile,
  listAllowedUsers,
  listChannelsForUser,
  listMessagesForChannel,
  messageSelect,
  reactionSummaries,
  requireChannelAccess,
  toMessageRow,
  unreadChatCounts,
} from "@/lib/chat";

export type CreateChannelResult = { errors?: string[]; channelId?: string };

/** A new group/DM channel. The creator is always included as a member. */
export async function createChannel(memberIds: string[], name?: string | null): Promise<CreateChannelResult> {
  const user = await requireUser();
  const allowed = new Set((await listAllowedUsers()).map((u) => u.id));
  const ids = [...new Set([user.id, ...memberIds])].filter((id) => allowed.has(id));
  if (ids.length < 2) return { errors: ["Pick at least one other person to chat with."] };

  const channel = await prisma.$transaction(async (tx) => {
    const created = await tx.chatChannel.create({
      data: { kind: "group", name: name?.trim() || null, createdById: user.id },
    });
    await tx.chatChannelMember.createMany({
      data: ids.map((userId) => ({ channelId: created.id, userId })),
    });
    return created;
  });
  return { channelId: channel.id };
}

export type SendMessageResult = { errors?: string[]; message?: MessageRow };

export async function sendMessage(channelId: string, body: string): Promise<SendMessageResult> {
  const user = await requireUser();
  await requireChannelAccess(channelId, user.id);
  const trimmed = body.trim();
  if (!trimmed) return { errors: ["Message can't be empty."] };
  if (trimmed.length > 4000) return { errors: ["That message is too long."] };

  const message = await prisma.chatMessage.create({
    data: { channelId, authorId: user.id, body: trimmed },
    select: messageSelect,
  });
  return { message: toMessageRow(message) };
}

export async function listMessages(channelId: string, after?: string): Promise<MessageRow[]> {
  const user = await requireUser();
  await requireChannelAccess(channelId, user.id);
  return listMessagesForChannel(channelId, after ? new Date(after) : undefined, user.id);
}

/** Toggles the current user's reaction of one kind on a message — on/off, per kind. */
export async function toggleMessageReaction(
  messageId: string,
  kind: ChatReactionKind
): Promise<{ error?: string; reactions?: ReactionSummary }> {
  if (!REACTION_KINDS.includes(kind)) return { error: "Unknown reaction." };
  const user = await requireUser();
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId }, select: { channelId: true } });
  if (!message) return { error: "That message no longer exists." };
  await requireChannelAccess(message.channelId, user.id);

  const existing = await prisma.chatMessageReaction.findUnique({
    where: { messageId_userId_kind: { messageId, userId: user.id, kind } },
  });
  if (existing) {
    await prisma.chatMessageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.chatMessageReaction.create({ data: { messageId, userId: user.id, kind } });
  }
  const summary = (await reactionSummaries([messageId], user.id))[messageId];
  return { reactions: summary };
}

export async function markChannelRead(channelId: string): Promise<void> {
  const user = await requireUser();
  await requireChannelAccess(channelId, user.id);
  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

/** Everyone you could start a channel with — yourself excluded, since you're always in it. */
export async function listAllowedUsersForPicker(): Promise<{ id: string; email: string; name: string | null }[]> {
  const user = await requireUser();
  return (await listAllowedUsers()).filter((u) => u.id !== user.id);
}

export async function loadChatProfile(): Promise<ChatProfileSettings> {
  const user = await requireUser();
  return getChatProfile(user.id);
}

export type SaveProfileResult = { errors?: string[]; profile?: ChatProfileSettings };

/** Saves someone's own chat settings. The row is created on first save. */
export async function saveChatProfile(input: {
  nickname: string;
  emoji: string | null;
  useGooglePhoto: boolean;
  notifyLevel: NotifyLevel;
}): Promise<SaveProfileResult> {
  const user = await requireUser();
  const nickname = input.nickname.trim().slice(0, 40);
  // One emoji, not a sentence. Intl.Segmenter counts what a reader calls a character,
  // so multi-codepoint emoji (skin tones, flags) count as one.
  const emoji = input.emoji?.trim() || null;
  if (emoji && [...new Intl.Segmenter().segment(emoji)].length > 1) {
    return { errors: ["Pick a single emoji."] };
  }
  const data = { nickname: nickname || null, emoji, useGooglePhoto: input.useGooglePhoto, notifyLevel: input.notifyLevel };
  await prisma.chatProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return { profile: await getChatProfile(user.id) };
}

/** Mutes or un-mutes one channel. null means "follow my default". */
export async function setChannelNotifyLevel(channelId: string, level: NotifyLevel | null): Promise<void> {
  const user = await requireUser();
  await requireChannelAccess(channelId, user.id);
  // The team channel has no membership row until someone opens it, so this upserts.
  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, notifyLevel: level },
    update: { notifyLevel: level },
  });
}

export type PollResult = {
  messages: MessageRow[];
  channels: ChannelSummary[];
  unread: Record<string, number>;
  /** Refreshed counts for the recent window, keyed by message id — a reaction on a
   *  message someone already has loaded isn't a "new message", so it wouldn't
   *  otherwise reach them until they reload. */
  reactions: Record<string, ReactionSummary>;
};

/** One round trip per poll tick: new messages in the open channel, plus the sidebar's unread counts. */
export async function pollChat(activeChannelId: string, after?: string | null): Promise<PollResult> {
  const user = await requireUser();
  await requireChannelAccess(activeChannelId, user.id);
  const [messages, channels, recent] = await Promise.all([
    listMessagesForChannel(activeChannelId, after ? new Date(after) : undefined, user.id),
    listChannelsForUser(user.id),
    prisma.chatMessage.findMany({
      where: { channelId: activeChannelId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true },
    }),
  ]);
  const { byChannel } = await unreadChatCounts(user.id, channels);
  const reactions = await reactionSummaries(recent.map((r) => r.id), user.id);
  return { messages, channels, unread: byChannel, reactions };
}
