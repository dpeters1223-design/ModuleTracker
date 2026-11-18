import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getFeatureRequestRows } from "@/lib/feature-requests";
import { FeatureRequestList } from "@/components/feature-request-list";

export const metadata: Metadata = { title: "Feature requests · ModuleTracker" };

export default async function RequestsPage() {
  await connection();
  const items = await getFeatureRequestRows();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Feature requests</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Ideas for the app itself — so they stop living only in Slack.
        </p>
      </div>
      <FeatureRequestList items={items} />
    </main>
  );
}
