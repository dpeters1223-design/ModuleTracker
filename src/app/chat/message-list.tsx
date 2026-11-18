"use client";

import Image from "next/image";
import { useEffect, useRef, useTransition } from "react";
import type { MessageRow, ReactionSummary } from "@/lib/chat";
import { toggleMessageReaction } from "./chat-actions";

/** "Today" / "Yesterday" / "Wed, Sep 24" for a "YYYY-MM-DD" already in the team's zone. */
function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

const displayName = (author: MessageRow["author"]) => author?.name ?? "Someone";

/** Up to two initials: "Jay Williamson" → JW, "mlh355@cornell.edu" → M. */
function initials(author: MessageRow["author"]): string {
  const name = author?.name?.trim();
  if (name && !name.includes("@")) {
    const parts = name.split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  return (name?.[0] ?? "?").toUpperCase();
}

// A stable tint per person so the same face-less avatar reads as the same person
// down a long thread. Muted on purpose — these sit next to every message.
const TINTS = [
  "bg-teal/15 text-teal dark:bg-teal/25 dark:text-teal-light",
  "bg-brand/10 text-brand dark:bg-brand/40 dark:text-zinc-100",
  "bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-300",
  "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300",
  "bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300",
];
const tintFor = (key: string) =>
  TINTS[[...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];

/** Their chosen emoji, else their Google photo, else initials on a stable tint. */
function Avatar({ author }: { author: MessageRow["author"] }) {
  if (author?.emoji) {
    return (
      <div
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-base dark:bg-zinc-800"
      >
        {author.emoji}
      </div>
    );
  }
  if (author?.image) {
    return (
      <Image
        src={author.image}
        alt=""
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tintFor(
        author?.email ?? "?"
      )}`}
    >
      {initials(author)}
    </div>
  );
}

/** Messages close together from one person read as one turn, so only the first is labelled. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** The "like/acknowledge" pill under a message. One fixed reaction, not an emoji picker. */
function LikeButton({
  messageId,
  reactions,
  onChanged,
}: {
  messageId: string;
  reactions: ReactionSummary;
  onChanged: (reactions: ReactionSummary) => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      title={reactions.names.length ? `Liked by ${reactions.names.join(", ")}` : "Like"}
      onClick={() => {
        // Optimistic count/mine; the server's reply (with real names) lands moments later.
        onChanged(
          reactions.mine
            ? { count: Math.max(0, reactions.count - 1), mine: false, names: reactions.names }
            : { count: reactions.count + 1, mine: true, names: reactions.names }
        );
        startTransition(async () => {
          const res = await toggleMessageReaction(messageId);
          if (res.reactions) onChanged(res.reactions);
        });
      }}
      className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition ${
        reactions.mine
          ? "border-teal bg-teal-light text-brand dark:border-teal dark:bg-teal/20 dark:text-teal-light"
          : "border-transparent text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
      }`}
    >
      <span aria-hidden>👍</span>
      {reactions.count > 0 && <span>{reactions.count}</span>}
    </button>
  );
}

export function MessageList({
  messages,
  currentUserEmail,
  today,
  onReactionChanged,
}: {
  messages: MessageRow[];
  currentUserEmail: string;
  today: string;
  onReactionChanged: (messageId: string, reactions: ReactionSummary) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    // Only follow the conversation when the reader is already at the bottom —
    // otherwise a new message yanks them out of the history they're reading.
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (atBottom || box.scrollTop === 0) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  if (!messages.length) {
    return (
      <div ref={scrollRef} className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="font-medium">No messages yet</p>
          <p className="mt-1 text-sm text-zinc-500">Say hello — everyone on the team can see this channel.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Messages"
      className="flex-1 overflow-y-auto px-4 py-3 sm:px-6"
    >
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || prev.day !== m.day;
        const mine = m.author?.email === currentUserEmail;
        const grouped =
          !newDay &&
          prev?.author?.id === m.author?.id &&
          m.createdAt.getTime() - prev.createdAt.getTime() < GROUP_WINDOW_MS;

        return (
          <div key={m.id}>
            {newDay && (
              <div className="flex items-center gap-3 py-3">
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {dayLabel(m.day, today)}
                </h3>
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            )}
            <div className={`flex gap-3 ${grouped ? "mt-0.5" : "mt-3"}`}>
              <div className="w-8 shrink-0">{!grouped && <Avatar author={m.author} />}</div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{mine ? "You" : displayName(m.author)}</span>
                    <span className="text-xs text-zinc-500">{m.time}</span>
                  </p>
                )}
                <div
                  title={grouped ? m.time : undefined}
                  className={`w-fit max-w-[70ch] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    mine
                      ? "bg-teal-light text-zinc-900 dark:bg-brand dark:text-zinc-100"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {m.body}
                </div>
                <LikeButton messageId={m.id} reactions={m.reactions} onChanged={(r) => onReactionChanged(m.id, r)} />
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
