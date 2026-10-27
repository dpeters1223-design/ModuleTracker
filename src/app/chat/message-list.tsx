"use client";

import { useEffect, useRef } from "react";
import type { MessageRow } from "@/lib/chat";

function timeLabel(createdAt: Date | string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessageList({ messages, currentUserEmail }: { messages: MessageRow[]; currentUserEmail: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.length === 0 && <p className="text-sm text-zinc-500">No messages yet — say hello.</p>}
      {messages.map((m) => {
        const mine = m.author?.email === currentUserEmail;
        return (
          <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                mine
                  ? "bg-brand text-white dark:bg-gold dark:text-brand"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {m.body}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              {!mine && (m.author?.name ?? m.author?.email ?? "Someone") + " · "}
              {timeLabel(m.createdAt)}
            </p>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
