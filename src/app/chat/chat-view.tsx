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
  today,
  initialChannels,
  initialActiveChannelId,
  initialMessages,
  initialUnread,
}: {
  currentUserEmail: string;
  today: string;
  initialChannels: ChannelSummary[];
  initialActiveChannelId: string;
  initialMessages: MessageRow[];
  initialUnread: Record<string, number>;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeId, setActiveId] = useState(initialActiveChannelId);
  const [messages, setMessages] = useState(initialMessages);
  const [unread, setUnread] = useState(initialUnread);
  const [offline, setOffline] = useState(false);
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

  // Opening a channel counts as reading it — without this the header badge, which
  // is rendered from lastReadAt on the server, keeps counting messages already read.
  useEffect(() => {
    markChannelRead(activeId).catch(() => {});
  }, [activeId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await pollChat(activeId, cursorRef.current);
        // A tick that resolves after a channel switch would write the old channel's
        // messages into the new channel's view.
        if (cancelled) return;
        setOffline(false);
        if (res.messages.length) {
          setMessages((m) => {
            const known = new Set(m.map((x) => x.id));
            return [...m, ...res.messages.filter((x) => !known.has(x.id))];
          });
          cursorRef.current = new Date(res.messages[res.messages.length - 1].createdAt).toISOString();
        }
        setChannels(res.channels);
        setUnread({ ...res.unread, [activeId]: 0 });
      } catch {
        // A dropped connection or an expired session shouldn't leave the page
        // looking live while it has silently stopped updating.
        if (!cancelled) setOffline(true);
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeId]);

  const active = channels.find((c) => c.id === activeId);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:min-h-0 lg:flex-row">
      <ChannelSidebar
        channels={channels}
        activeId={activeId}
        unread={unread}
        onSelect={loadChannel}
        onCreated={loadChannel}
      />
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        <header className="flex items-baseline justify-between gap-3 border-b border-zinc-300 px-4 py-3 sm:px-6 dark:border-zinc-700">
          <h1 className="truncate font-semibold tracking-tight">{active?.label ?? "Chat"}</h1>
          <p className="shrink-0 text-xs text-zinc-500">
            {active?.kind === "team" ? "Everyone on the team" : "Private"}
          </p>
        </header>
        {offline && (
          <p role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Reconnecting — new messages may be delayed.
          </p>
        )}
        <MessageList messages={messages} currentUserEmail={currentUserEmail} today={today} />
        <Composer
          channelId={activeId}
          onSent={(message) => {
            setMessages((m) => [...m, message]);
            cursorRef.current = new Date(message.createdAt).toISOString();
          }}
        />
      </section>
    </main>
  );
}
