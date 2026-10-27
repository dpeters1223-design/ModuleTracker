"use client";

import { useEffect, useState, useTransition } from "react";
import type { ChatProfileSettings, NotifyLevel } from "@/lib/chat";
import { loadChatProfile, saveChatProfile } from "./chat-actions";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;

// A small spread rather than a full picker: enough to pick something that feels like
// you, without pulling in an emoji library for an eight-person team.
const EMOJI = [
  "🙂", "😎", "🤓", "🧑‍🔬", "👩‍🔬", "🧑‍💻", "🎬", "🎥",
  "🎨", "🧪", "⚛️", "🔬", "🛠️", "📐", "🚀", "🌈",
  "🐙", "🦊", "🐢", "🦉", "🌻", "☕", "🧊", "⭐",
];

const NOTIFY: { value: NotifyLevel; label: string; hint: string }[] = [
  { value: "all", label: "All messages", hint: "Badge counts every new message" },
  { value: "mentions", label: "Mentions only", hint: "Nothing yet — @-mentions aren't built, so this mutes" },
  { value: "none", label: "Nothing", hint: "No badge from chat at all" },
];

export function ChatSettings({ onSaved }: { onSaved: () => void }) {
  const [profile, setProfile] = useState<ChatProfileSettings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadChatProfile().then(setProfile);
  }, []);

  if (!profile) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-sm text-zinc-500" role="status">
          Loading your settings…
        </p>
      </div>
    );
  }

  const set = <K extends keyof ChatProfileSettings>(key: K, value: ChatProfileSettings[K]) => {
    setSaved(false);
    setProfile({ ...profile, [key]: value });
  };

  return (
    <form
      className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveChatProfile({
            nickname: profile.nickname,
            emoji: profile.emoji,
            useGooglePhoto: profile.useGooglePhoto,
            notifyLevel: profile.notifyLevel,
          });
          if (res.errors?.length) return setErrors(res.errors);
          setErrors([]);
          if (res.profile) setProfile(res.profile);
          setSaved(true);
          onSaved();
        });
      }}
    >
      {errors.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-sm text-red-700 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <section className="space-y-2">
        <label htmlFor="chat-nickname" className="block text-sm font-semibold">
          Nickname
        </label>
        <input
          id="chat-nickname"
          className={`${inputCls} w-full max-w-sm`}
          placeholder={profile.googleName ?? "Your name"}
          value={profile.nickname}
          onChange={(e) => set("nickname", e.target.value)}
        />
        <p className="text-xs text-zinc-500">
          What chat calls you. Leave it blank to stay {profile.googleName ?? "your account name"}. This only
          changes chat — task owners and the rest of the tracker are unaffected.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Avatar</h2>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={profile.emoji === null}
            onClick={() => set("emoji", null)}
            className={`rounded-md border px-2 py-1 text-xs ${
              profile.emoji === null
                ? "border-brand bg-zinc-100 font-semibold text-brand dark:border-gold dark:bg-zinc-800 dark:text-gold"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            None
          </button>
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Use ${e} as your avatar`}
              aria-pressed={profile.emoji === e}
              onClick={() => set("emoji", e)}
              className={`rounded-md border px-2 py-1 text-base leading-5 ${
                profile.emoji === e
                  ? "border-brand bg-zinc-100 dark:border-gold dark:bg-zinc-800"
                  : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        {profile.hasGooglePhoto ? (
          <label className="flex items-center gap-2 pt-1 text-sm">
            <input
              type="checkbox"
              checked={profile.useGooglePhoto}
              onChange={(e) => set("useGooglePhoto", e.target.checked)}
            />
            Use my Google profile photo when I haven&apos;t picked an emoji
          </label>
        ) : (
          <p className="pt-1 text-xs text-zinc-500">
            Your Google account has no photo, so your initials are used unless you pick an emoji.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <p className="text-xs text-zinc-500">
          Your default for every channel. You can override it per channel from the channel header.
        </p>
        <div className="space-y-1.5">
          {NOTIFY.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="notifyLevel"
                className="mt-1"
                checked={profile.notifyLevel === o.value}
                onChange={() => set("notifyLevel", o.value)}
              />
              <span>
                {o.label}
                <span className="block text-xs text-zinc-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className={primaryBtn} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <p role="status" className="text-sm text-zinc-500">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
