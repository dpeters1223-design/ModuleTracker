"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  type ChannelSummary,
  type MessageRow,
  listAllowedUsers,
  listChannelsForUser,
  listMessagesForChannel,
  requireChannelAccess,
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
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });
  return { message };
}

export async function listMessages(channelId: string, after?: string): Promise<MessageRow[]> {
  const user = await requireUser();
  await requireChannelAccess(channelId, user.id);
  return listMessagesForChannel(channelId, after ? new Date(after) : undefined);
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

export async function listAllowedUsersForPicker(): Promise<{ id: string; email: string; name: string | null }[]> {
  await requireUser();
  return listAllowedUsers();
}

export type PollResult = { messages: MessageRow[]; channels: ChannelSummary[]; unread: Record<string, number> };

/** One round trip per poll tick: new messages in the open channel, plus the sidebar's unread counts. */
export async function pollChat(activeChannelId: string, after?: string | null): Promise<PollResult> {
  const user = await requireUser();
  await requireChannelAccess(activeChannelId, user.id);
  const [messages, channels] = await Promise.all([
    listMessagesForChannel(activeChannelId, after ? new Date(after) : undefined),
    listChannelsForUser(user.id),
  ]);
  const { byChannel } = await unreadChatCounts(user.id, channels);
  return { messages, channels, unread: byChannel };
}
