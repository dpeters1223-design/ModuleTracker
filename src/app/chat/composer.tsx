"use client";

import { useState, useTransition } from "react";
import type { MessageRow } from "@/lib/chat";
import { sendMessage } from "./chat-actions";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const primaryBtn =
  "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-hover " +
  "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gold dark:text-brand dark:hover:bg-gold-dark";

export function Composer({ channelId, onSent }: { channelId: string; onSent: (message: MessageRow) => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const text = body;
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await sendMessage(channelId, text);
      if (res.errors?.length) return setError(res.errors[0]);
      setError(null);
      setBody("");
      if (res.message) onSent(res.message);
    });
  };

  return (
    <div className="border-t border-zinc-300 p-3 dark:border-zinc-700">
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          aria-label="Message"
          rows={1}
          className={`${inputCls} flex-1 resize-none`}
          placeholder="Message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" className={primaryBtn} disabled={pending || !body.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
