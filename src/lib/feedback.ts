import type { FeedbackCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moduleTitle } from "@/lib/script-template";
import { dayInZone, timeInZone } from "@/lib/dates";
import { dayLabel } from "@/lib/activity-feed";
import { parseFeedbackTags } from "@/lib/ai-sort";
import type { FeedbackRow } from "@/components/feedback-list";

/** Every playthrough write-up matching `where`, newest first, with its module/task context. */
export async function getFeedbackRows(
  where: Prisma.PlaythroughFeedbackWhereInput,
  viewerId: string
): Promise<FeedbackRow[]> {
  const rows = await prisma.playthroughFeedback.findMany({
    where,
    include: { task: { select: { id: true, title: true, module: { select: { id: true, number: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((f) => ({
    id: f.id,
    moduleId: f.task.module.id,
    moduleLabel: moduleTitle(f.task.module),
    taskId: f.task.id,
    taskTitle: f.task.title,
    authorName: f.authorName,
    when: `${dayLabel(dayInZone(f.createdAt))} at ${timeInZone(f.createdAt)}`,
    body: f.body,
    categories: f.categories,
    tags: parseFeedbackTags(f.tags),
    mine: f.authorId === viewerId,
  }));
}

/** How many playthrough write-ups carry each category, in the fixed display order. */
export function categoryCounts(rows: { categories: FeedbackCategory[] }[]): Record<FeedbackCategory, number> {
  const counts: Record<FeedbackCategory, number> = { instructional_design: 0, ui_ux: 0, media: 0, tags: 0 };
  for (const r of rows) for (const c of r.categories) counts[c]++;
  return counts;
}
