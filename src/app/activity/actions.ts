"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { undoActivity } from "@/lib/activity";
import { changed } from "@/lib/changed";

export async function undoChange(activityId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const result = await undoActivity(user, activityId);
  if (!result.error) changed();
  return result;
}

/** Clears the bell: everything up to now counts as seen. Not a data change, so no backup. */
export async function markNotificationsSeen() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenActivityAt: new Date() } });
  revalidatePath("/", "layout");
}
