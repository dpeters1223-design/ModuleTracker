import { NextResponse } from "next/server";
import { buildDueDigest, sendDueDigest } from "@/lib/due-digest";

// Morning roundup of overdue and nearly-due tasks, called by Vercel Cron (see
// vercel.json). Same gate as the nightly backup: Vercel sends
// `Authorization: Bearer $CRON_SECRET`, and the sign-in proxy lets /api/cron through,
// so this secret check is the only thing standing in front of it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    // ?preview=1 composes the message and hands it back without posting, so the
    // roundup can be checked before it goes to the channel.
    if (new URL(request.url).searchParams.get("preview") === "1") {
      const { blocks, ...preview } = await buildDueDigest();
      void blocks;
      return NextResponse.json({ ok: true, preview: true, ...preview });
    }
    const result = await sendDueDigest();
    // A post that never landed is still a failed job, even though nothing threw.
    const status = result.error ? 500 : 200;
    return NextResponse.json({ ok: !result.error, ...result }, { status });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[digest] morning roundup failed:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
