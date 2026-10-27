"use client";

import { useEffect, useRef, useState } from "react";
import type { ChannelSummary, MessageRow } from "@/lib/chat";
import { markChannelRead, pollChat } from "./chat-actions";
import { ChannelSidebar } from "./channel-sidebar";
import { MessageList } from "./message-list";
import { Composer } from "./composer";

const POLL_MS = 4000;

export function ChatView({
  currentUserEmail,
  initialChannels,
  initialActiveChannelId,
  initialMessages,
  initialUnread,
}: {
  currentUserEmail: string;
  initialChannels: ChannelSummary[];
  initialActiveChannelId: string;
  initialMessages: MessageRow[];
  initialUnread: Record<string, number>;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeId, setActiveId] = useState(initialActiveChannelId);
  const [messages, setMessages] = useState(initialMessages);
  const [unread, setUnread] = useState(initialUnread);
  const cursorRef = useRef<string | null>(
    initialMessages.length ? new Date(initialMessages[initialMessages.length - 1].createdAt).toISOString() : null
  );

  /** Switches the active channel (or refreshes it, e.g. right after creating one). */
  async function loadChannel(id: string) {
    setActiveId(id);
    const res = await pollChat(id, null);
    setMessages(res.messages);
    setChannels(res.channels);
    cursorRef.current = res.messages.length
      ? new Date(res.messages[res.messages.length - 1].createdAt).toISOString()
      : null;
    setUnread({ ...res.unread, [id]: 0 });
    markChannelRead(id);
  }

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await pollChat(activeId, cursorRef.current);
      if (res.messages.length) {
        setMessages((m) => {
          const known = new Set(m.map((x) => x.id));
          return [...m, ...res.messages.filter((x) => !known.has(x.id))];
        });
        cursorRef.current = new Date(res.messages[res.messages.length - 1].createdAt).toISOString();
      }
      setChannels(res.channels);
      setUnread({ ...res.unread, [activeId]: 0 });
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [activeId]);

  const activeLabel = channels.find((c) => c.id === activeId)?.label ?? "";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl gap-4 px-4 py-6 sm:px-6">
      <ChannelSidebar
        channels={channels}
        activeId={activeId}
        unread={unread}
        onSelect={loadChannel}
        onCreated={loadChannel}
      />
      <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        <div className="border-b border-zinc-300 px-4 py-3 text-sm font-medium dark:border-zinc-700">
          {activeLabel}
        </div>
        <MessageList messages={messages} currentUserEmail={currentUserEmail} />
        <Composer
          channelId={activeId}
          onSent={(message) => {
            setMessages((m) => [...m, message]);
            cursorRef.current = new Date(message.createdAt).toISOString();
          }}
        />
      </div>
    </div>
  );
}
