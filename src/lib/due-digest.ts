import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, hourInZone, noonUtc, todayInZone } from "@/lib/dates";
import { moduleTitle } from "@/lib/script-template";
import { appUrl, postToSlackNow, slackEscape } from "@/lib/slack";
import { TEAM, buildOwnerIndex, isOwnedBy } from "@/lib/team";
import { formatDay } from "@/lib/task-format";

// The morning roundup: one Slack post listing what is overdue, due today or due
// tomorrow, split into a section per owner so each person can be @-mentioned.
//
//   SLACK_USER_IDS    — "email:U0123ABCD,email:U0456WXYZ"; a person with no entry is
//                       named in plain text instead of being pinged. Slack only
//                       notifies on the raw <@U…> form, and member IDs can't be
//                       derived from an email without a bot token.
//   DIGEST_GIF_URLS   — optional direct .gif/.png URLs, comma-separated. One is
//                       picked per day so the message isn't the same every morning.

/** Slack member IDs by email, from SLACK_USER_IDS. */
function slackIds(): Map<string, string> {
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

/** A stable GIF for this calendar day, so the roundup varies without being random. */
function gifForDay(day: string): string | null {
  const gifs = (process.env.DIGEST_GIF_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!gifs.length) return null;
  return gifs[Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000) % gifs.length];
}

type DigestTask = {
  id: string;
  title: string;
  owner: string | null;
  dueDate: Date | null;
  module: { id: string; number: string | null; name: string };
  parent: { title: string } | null;
};

type Bucket = "overdue" | "today" | "tomorrow";
type Row = { task: DigestTask; bucket: Bucket };

const BULLET: Record<Bucket, string> = {
  overdue: ":red_circle:",
  today: ":large_yellow_circle:",
  tomorrow: ":white_circle:",
};

/** One task as a Slack bullet: status dot, title, when it's due, and its module as a link. */
function taskLine({ task, bucket }: Row, today: string): string {
  const day = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "";
  const when =
    bucket === "overdue"
      ? `overdue since ${formatDay(day, today)}`
      : bucket === "today"
        ? "due today"
        : "due tomorrow";
  const parent = task.parent ? ` _(part of ${slackEscape(task.parent.title)})_` : "";
  const where = ` · <${appUrl(`/modules/${task.module.id}`)}|${slackEscape(moduleTitle(task.module))}>`;
  return `${BULLET[bucket]} *${slackEscape(task.title)}*${parent} — ${when}${where}`;
}

export type DigestContent = {
  /** Set when there is nothing to send; text and blocks are then empty. */
  nothingDue?: string;
  text: string;
  blocks: unknown[];
  overdue: number;
  today: number;
  tomorrow: number;
  people: number;
};

/** Composes the roundup without sending it, so it can also be previewed. */
export async function buildDueDigest(): Promise<DigestContent> {
  const today = todayInZone();
  const tomorrow = addDays(today, 1);

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "completed" }, dueDate: { lte: noonUtc(tomorrow) } },
      select: {
        id: true,
        title: true,
        owner: true,
        dueDate: true,
        module: { select: { id: true, number: true, name: true } },
        parent: { select: { title: true } },
      },
      orderBy: [{ dueDate: "asc" }, { order: "asc" }],
    }),
    prisma.user.findMany({ select: { email: true, name: true } }),
  ]);

  const bucketOf = (task: DigestTask): Bucket | null => {
    const day = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "";
    if (!day) return null;
    if (day < today) return "overdue";
    if (day === today) return "today";
    if (day === tomorrow) return "tomorrow";
    return null;
  };

  const due: Row[] = [];
  for (const task of tasks) {
    const bucket = bucketOf(task);
    if (bucket) due.push({ task, bucket });
  }

  const counts = {
    overdue: due.filter((r) => r.bucket === "overdue").length,
    today: due.filter((r) => r.bucket === "today").length,
    tomorrow: due.filter((r) => r.bucket === "tomorrow").length,
  };
  if (!due.length) {
    return { nothingDue: "nothing overdue or due in the next day", text: "", blocks: [], ...counts, people: 0 };
  }

  // Owner boxes are free text, so a task can belong to several people or to nobody
  // the roster recognises. Everything unmatched goes in a final section rather than
  // dropping out of the roundup.
  const index = buildOwnerIndex(users);
  const roster = new Map<string, string>();
  for (const m of TEAM) roster.set(m.email.toLowerCase(), m.name);
  for (const u of users) {
    const email = u.email.toLowerCase();
    if (!roster.get(email)) roster.set(email, u.name ?? email);
  }

  const byPerson = new Map<string, Row[]>();
  const unmatched: Row[] = [];
  for (const row of due) {
    const owners = [...roster.keys()].filter((email) => isOwnedBy(row.task.owner, email, index));
    if (!owners.length) {
      unmatched.push(row);
      continue;
    }
    for (const email of owners) {
      if (!byPerson.has(email)) byPerson.set(email, []);
      byPerson.get(email)!.push(row);
    }
  }

  const ids = slackIds();
  const order: Bucket[] = ["overdue", "today", "tomorrow"];
  const linesFor = (rows: Row[]) =>
    order.flatMap((bucket) => rows.filter((r) => r.bucket === bucket).map((r) => taskLine(r, today)));

  const sections = [...byPerson.entries()]
    .sort((a, b) => (roster.get(a[0]) || a[0]).localeCompare(roster.get(b[0]) || b[0]))
    .map(([email, rows]) => {
      const id = ids.get(email);
      // The mention token must skip slackEscape — escaped angle brackets render as text.
      const heading = id ? `<@${id}>` : `*${slackEscape(roster.get(email) || email)}*`;
      return [heading, ...linesFor(rows)].join("\n");
    });

  if (unmatched.length) sections.push(["*No owner matched*", ...linesFor(unmatched)].join("\n"));

  const headline =
    ":sunrise: *Morning roundup* — " +
    [
      counts.overdue ? `${counts.overdue} overdue` : null,
      counts.today ? `${counts.today} due today` : null,
      counts.tomorrow ? `${counts.tomorrow} due tomorrow` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const body = [headline, ...sections].join("\n\n");
  const footer = `<${appUrl("/tasks")}|Open the tracker> to update a date or mark something done.`;
  const gif = gifForDay(today);

  return {
    text: `${body}\n\n${footer}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: body } },
      ...(gif ? [{ type: "image", image_url: gif, alt_text: "Morning roundup" }] : []),
      { type: "context", elements: [{ type: "mrkdwn", text: footer }] },
    ],
    ...counts,
    people: byPerson.size,
  };
}

export type DigestResult = {
  posted: boolean;
  skipped?: string;
  overdue: number;
  today: number;
  tomorrow: number;
  people: number;
  error?: string;
};

/**
 * Builds and sends the roundup. Reports what it did rather than throwing, so the
 * cron route can surface it: a silent failure here would look like a quiet morning.
 */
export async function sendDueDigest(): Promise<DigestResult> {
  // Vercel crons are scheduled in UTC and Hobby fires anywhere within the hour, so
  // confirm it really is working hours here before pinging anyone.
  const hour = hourInZone();
  if (hour < 9 || hour >= 17) {
    return { posted: false, skipped: `outside 9am-5pm (local hour ${hour})`, overdue: 0, today: 0, tomorrow: 0, people: 0 };
  }

  const { nothingDue, text, blocks, overdue, today, tomorrow, people } = await buildDueDigest();
  const counts = { overdue, today, tomorrow, people };
  if (nothingDue) return { posted: false, skipped: nothingDue, ...counts };

  const { posted, error } = await postToSlackNow({ text, blocks });
  return { posted, ...counts, ...(error ? { error } : {}) };
}
