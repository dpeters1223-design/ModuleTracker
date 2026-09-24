import { NextResponse } from "next/server";
import { saveBackup } from "@/lib/backup";

// Nightly backup, called by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; anything else is refused. The sign-in
// proxy lets /api/cron through, so this secret check is the only gate.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await saveBackup("daily");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[backup] nightly backup failed:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
