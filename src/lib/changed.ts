import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { saveBackup } from "@/lib/backup";

/**
 * Call after any change to app data: refreshes every page, then (after the
 * response has gone out, so nobody waits) replaces latest.json in the backup
 * folder. A failed backup is logged, never shown to the user.
 */
export function changed() {
  revalidatePath("/", "layout");
  after(async () => {
    try {
      await saveBackup("latest");
    } catch (e) {
      console.error("[backup] latest.json failed:", e instanceof Error ? e.message : e);
    }
  });
}
