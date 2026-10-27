import "server-only";
import { after } from "next/server";

// Slack alerts go to one channel through an incoming webhook:
//   SLACK_WEBHOOK_URL — the webhook's URL (a secret); unset means Slack alerts are off
//   APP_URL           — base for links in messages (defaults to the live site)

export const appUrl = (path = "") =>
  (process.env.APP_URL?.trim().replace(/\/$/, "") || "https://vr-module-tracker.vercel.app") + path;

/** Escapes text for Slack's mrkdwn (only &, < and > are special). */
export const slackEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
