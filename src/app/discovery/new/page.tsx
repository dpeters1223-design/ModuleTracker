import type { Metadata } from "next";
import { DiscoveryForm } from "@/components/discovery-form";

export const metadata: Metadata = {
  title: "New module · Discovery Form · ModuleTracker",
};

export default function NewDiscoveryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Discovery Form</h1>
      <p className="mt-1 mb-6 text-zinc-600 dark:text-zinc-400">
        Kick off a new module: what it covers, the tools involved, and a scene-by-scene outline.
      </p>
      <DiscoveryForm />
    </main>
  );
}
