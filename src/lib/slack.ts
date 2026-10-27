import "server-only";
import { after } from "next/server";

// Slack alerts go to one channel through an incoming webhook:
//   SLACK_WEBHOOK_URL — the webhook's URL (a secret); unset means Slack alerts are off
//   APP_URL           — base for links in messages (defaults to the live site)

export const appUrl = (path = "") =>
  (process.env.APP_URL?.trim().replace(/\/$/, "") || "https://vr-module-tracker.vercel.app") + path;

/** Escapes text for Slack's mrkdwn (only &, < and > are special). */
export const slackEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Slack member IDs by email, from SLACK_USER_IDS ("email:U0123ABCD,email:U0456WXYZ").
 * Slack only notifies on the raw <@U…> form, and an ID cannot be derived from an
 * email without a bot token, so the mapping is kept by hand.
 */
export function slackIds(): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of (process.env.SLACK_USER_IDS ?? "").split(",")) {
    const at = pair.lastIndexOf(":");
    if (at < 1) continue;
    const email = pair.slice(0, at).trim().toLowerCase();
    const id = pair.slice(at + 1).trim();
    if (email && id) map.set(email, id);
  }
  return map;
}

/**
 * The mention token for an email, or null when no ID is on file. Never pass the
 * result through slackEscape — escaped angle brackets render as literal text.
 */
export function slackMention(email: string, ids = slackIds()): string | null {
  const id = ids.get(email.trim().toLowerCase());
  return id ? `<@${id}>` : null;
}

/** A Slack webhook payload. `text` is the notification fallback when `blocks` are used. */
export type SlackPayload = { text: string; blocks?: unknown[] };

/**
 * Posts and waits, reporting whether it landed. For scheduled jobs, whose HTTP
 * response is the only place a failure can surface — postToSlackLater swallows
 * errors, which would let a cron report success over a post that never arrived.
 */
export async function postToSlackNow(payload: SlackPayload): Promise<{ posted: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return { posted: false, error: "SLACK_WEBHOOK_URL is not set" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { posted: false, error: `${res.status}: ${await res.text()}` };
    return { posted: true };
  } catch (e) {
    return { posted: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Posts a message after the response has gone out, so nobody waits on Slack.
 * Does nothing when SLACK_WEBHOOK_URL isn't set; failures are logged, never shown.
 */
export function postToSlackLater(message: () => Promise<string | null>) {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;
  after(async () => {
    try {
      const text = await message();
      if (!text) return;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) console.error(`[slack] post failed (${res.status}): ${await res.text()}`);
    } catch (e) {
      console.error("[slack] post failed:", e instanceof Error ? e.message : e);
    }
  });
}
