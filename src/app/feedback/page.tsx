import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getFeedbackRows } from "@/lib/feedback";
import { getModuleOptions } from "@/lib/change-orders";
import { FeedbackFilterView } from "@/components/feedback-filter-view";

export const metadata: Metadata = { title: "Feedback · ModuleTracker" };

export default async function FeedbackPage() {
  await connection();
  const session = await auth();
  const [rows, modules] = await Promise.all([getFeedbackRows({}, session?.user?.id ?? ""), getModuleOptions()]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Every playthrough write-up, across every module.</p>
      </div>
      <FeedbackFilterView rows={rows} modules={modules} />
    </main>
  );
}
