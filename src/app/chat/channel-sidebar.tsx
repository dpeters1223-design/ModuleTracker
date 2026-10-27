"use client";

import { useState, useTransition } from "react";
import type { ChannelSummary } from "@/lib/chat";
import { createChannel, listAllowedUsersForPicker } from "./chat-actions";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;

export function ChannelSidebar({
  channels,
  activeId,
  unread,
  onSelect,
  onCreated,
  settingsOpen,
  onOpenSettings,
}: {
  channels: ChannelSummary[];
  activeId: string;
  unread: Record<string, number>;
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
  settingsOpen: boolean;
  onOpenSettings: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [people, setPeople] = useState<{ id: string; email: string; name: string | null }[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const startAdding = () => {
    setAdding(true);
    if (!people) startTransition(async () => setPeople(await listAllowedUsersForPicker()));
  };

  return (
    // Phones get a horizontal row of channel pills above the thread; from lg it is a
    // proper sidebar. The app has no hide-a-pane pattern, so nothing is hidden.
    <nav aria-label="Channels" className="flex w-full shrink-0 flex-col gap-3 lg:w-60">
      <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {channels.map((c) => {
          const count = unread[c.id] ?? 0;
          const active = c.id === activeId;
          return (
            <li key={c.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm whitespace-nowrap transition lg:whitespace-normal ${
                  active
                    ? "bg-zinc-100 font-semibold text-brand lg:border-l-2 lg:border-brand dark:bg-zinc-800 dark:text-gold dark:lg:border-gold"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="min-w-0 truncate">
                  {c.label}
                  {c.notify !== "all" && <span className="ml-1.5 text-xs font-normal text-zinc-400">muted</span>}
                </span>
                {count > 0 && !active && (
                  <span
                    aria-label={`${count} unread`}
                    className="shrink-0 rounded-full bg-lab-red px-1.5 text-xs font-semibold text-white"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!adding && (
        <div className="flex gap-2">
          <button type="button" className={`${secondaryBtn} lg:flex-1`} onClick={startAdding}>
            + New channel
          </button>
          <button
            type="button"
            aria-current={settingsOpen ? "true" : undefined}
            className={`${secondaryBtn} ${settingsOpen ? "bg-zinc-100 font-semibold text-brand dark:bg-zinc-800 dark:text-gold" : ""}`}
            onClick={onOpenSettings}
          >
            Settings
          </button>
        </div>
      )}

      {adding && (
        <form
          className="space-y-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createChannel(selected, name || null);
              if (res.errors?.length) return setErrors(res.errors);
              setErrors([]);
              setAdding(false);
              setSelected([]);
              setName("");
              if (res.channelId) onCreated(res.channelId);
            });
          }}
        >
          {errors.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-xs text-red-700 dark:text-red-400">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Who can see it
            </legend>
            {people === null ? (
              <p className="text-xs text-zinc-500" role="status">
                Loading people…
              </p>
            ) : people.length === 0 ? (
              <p className="text-xs text-zinc-500">Nobody else has signed in yet.</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((id) => id !== p.id)))
                      }
                    />
                    {p.name ?? p.email}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {selected.length > 1 && (
            <input
              aria-label="Channel name (optional)"
              className={`${inputCls} w-full`}
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={pending || selected.length === 0}>
              {pending ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setErrors([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </nav>
  );
}
