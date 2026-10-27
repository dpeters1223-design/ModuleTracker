import "server-only";
import { prisma } from "@/lib/prisma";
import { emailList } from "@/lib/activity";
import { addDays, hourInZone, noonUtc, todayInZone } from "@/lib/dates";
import { moduleTitle } from "@/lib/script-template";
import { appUrl, postToSlackNow, slackEscape } from "@/lib/slack";
import { TEAM, buildOwnerIndex, isOwnedBy } from "@/lib/team";
import { formatDay } from "@/lib/task-format";

// The morning roundup: one Slack post listing what is overdue, due today or due
// tomorrow, split into a section per owner so each person can be @-mentioned.
//
//   DIGEST_PEOPLE     — whose tasks the roundup covers, as emails. Unset means
//                       everyone, and then tasks whose Owner box matches nobody get
//                       their own section so they can't quietly drop out.
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

/** How far back the roundup looks for new playthrough write-ups. */
const FEEDBACK_WINDOW_HOURS = 24;

/**
 * Playthrough write-ups submitted since yesterday's roundup, as one Slack section
 * that @-mentions everyone the roundup goes to — a write-up landing is news for all
 * of them, not just whoever owns the task.
 *
 * The window is a rolling 24 hours rather than a stored watermark. Vercel Hobby fires
 * a cron within the hour of its schedule, so a write-up submitted inside that drift
 * can in principle be missed; the section links to the module, and the write-ups stay
 * on the task, so nothing is lost if it is.
 */
async function feedbackSection(mentions: string[]): Promise<{ section: string | null; count: number }> {
  const since = new Date(Date.now() - FEEDBACK_WINDOW_HOURS * 3_600_000);
  const rows = await prisma.playthroughFeedback.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: {
      authorName: true,
      body: true,
      task: { select: { title: true, module: { select: { id: true, number: true, name: true } } } },
    },
  });
  if (!rows.length) return { section: null, count: 0 };

  const lines = rows.map((f) => {
    const where = `<${appUrl(`/modules/${f.task.module.id}`)}|${slackEscape(moduleTitle(f.task.module))}>`;
    // Transcripts run to thousands of words; the roundup carries an opening line.
    const flat = f.body.replace(/\s+/g, " ").trim();
    const excerpt = flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
    return (
      `:memo: *${slackEscape(f.authorName ?? "Someone")}* wrote up *${slackEscape(f.task.title)}* · ${where}\n` +
      `> ${slackEscape(excerpt)}`
    );
  });

  const heading = `*New playthrough feedback*${mentions.length ? ` ${mentions.join(" ")}` : ""}`;
  return { section: [heading, ...lines].join("\n"), count: rows.length };
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
  feedback: number;
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

  const tally = (rows: Row[]) => ({
    overdue: rows.filter((r) => r.bucket === "overdue").length,
    today: rows.filter((r) => r.bucket === "today").length,
    tomorrow: rows.filter((r) => r.bucket === "tomorrow").length,
  });

  const ids = slackIds();
  const only = emailList(process.env.DIGEST_PEOPLE);
  const feedback = await feedbackSection(only.map((e) => ids.get(e)).filter((id): id is string => Boolean(id)));

  if (!due.length && !feedback.section) {
    return {
      nothingDue: "nothing overdue, due in the next day, or newly written up",
      text: "",
      blocks: [],
      ...tally([]),
      people: 0,
      feedback: 0,
    };
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

  // While the roundup covers only some of the team, everyone else's tasks are
  // somebody else's business — including the ones no owner matched.
  if (only.length) for (const email of [...roster.keys()]) if (!only.includes(email)) roster.delete(email);

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

  const showUnmatched = unmatched.length > 0 && !only.length;
  if (showUnmatched) sections.push(["*No owner matched*", ...linesFor(unmatched)].join("\n"));
  if (feedback.section) sections.push(feedback.section);

  // Count what the message actually lists, not what was due across the whole team.
  // A task owned by two people is listed twice but is still one task.
  const listed = [...new Map(
    [...[...byPerson.values()].flat(), ...(showUnmatched ? unmatched : [])].map((r) => [r.task.id, r])
  ).values()];
  const counts = tally(listed);

  if (!sections.length) {
    return {
      nothingDue: "nothing due for the people in DIGEST_PEOPLE",
      text: "",
      blocks: [],
      ...counts,
      people: 0,
      feedback: 0,
    };
  }

  const headline =
    ":sunrise: *Morning roundup* — " +
    [
      counts.overdue ? `${counts.overdue} overdue` : null,
      counts.today ? `${counts.today} due today` : null,
      counts.tomorrow ? `${counts.tomorrow} due tomorrow` : null,
      feedback.count ? `${feedback.count} new write-up${feedback.count === 1 ? "" : "s"}` : null,
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
    feedback: feedback.count,
  };
}

/**
 * Posts a one-off ping to a single person, to check the webhook and that their
 * Slack member ID really notifies them — without waiting for something of theirs
 * to fall due, and without pinging anyone else on the way.
 */
export async function sendTestPing(email: string): Promise<{ posted: boolean; mentioned: boolean; error?: string }> {
  const id = slackIds().get(email.trim().toLowerCase());
  const who = id ? `<@${id}>` : `*${slackEscape(email)}*`;
  const text =
    `:wave: ${who} — test ping from the module tracker. ` +
    `If this pinged you, the morning roundup will too. ` +
    `<${appUrl("/tasks")}|Open the tracker>`;
  const { posted, error } = await postToSlackNow({ text });
  return { posted, mentioned: Boolean(id), ...(error ? { error } : {}) };
}

export type DigestResult = {
  posted: boolean;
  skipped?: string;
  overdue: number;
  today: number;
  tomorrow: number;
  people: number;
  feedback: number;
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
    return {
      posted: false,
      skipped: `outside 9am-5pm (local hour ${hour})`,
      overdue: 0,
      today: 0,
      tomorrow: 0,
      people: 0,
      feedback: 0,
    };
  }

  const { nothingDue, text, blocks, overdue, today, tomorrow, people, feedback } = await buildDueDigest();
  const counts = { overdue, today, tomorrow, people, feedback };
  if (nothingDue) return { posted: false, skipped: nothingDue, ...counts };

  const { posted, error } = await postToSlackNow({ text, blocks });
  return { posted, ...counts, ...(error ? { error } : {}) };
}
