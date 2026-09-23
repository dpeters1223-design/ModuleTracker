import type { Metadata } from "next";
import { connection } from "next/server";
import { getChangeOrderRows, getModuleOptions } from "@/lib/change-orders";
import { ChangeOrderList } from "@/components/change-order-list";

export const metadata: Metadata = { title: "Change orders · ModuleTracker" };

export default async function ChangesPage() {
  await connection();
  const [items, modules] = await Promise.all([getChangeOrderRows(), getModuleOptions()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Change orders</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Changes requested for modules that are already signed off or deployed, including ones that
          apply to every module.
        </p>
      </div>
      <ChangeOrderList items={items} modules={modules} today={today} showModule />
    </main>
  );
}
