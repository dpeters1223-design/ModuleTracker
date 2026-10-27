import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/session";
import { TEAM_CHANNEL_ID, listChannelsForUser, listMessagesForChannel, unreadChatCounts } from "@/lib/chat";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Chat · ModuleTracker" };

export default async function ChatPage() {
  await connection();
  const user = await requireUser();
  const channels = await listChannelsForUser(user.id);
  const [messages, { byChannel }] = await Promise.all([
    listMessagesForChannel(TEAM_CHANNEL_ID),
    unreadChatCounts(user.id, channels),
  ]);
  return (
    <ChatView
      currentUserEmail={user.email}
      initialChannels={channels}
      initialActiveChannelId={TEAM_CHANNEL_ID}
      initialMessages={messages}
      initialUnread={byChannel}
    />
  );
}
