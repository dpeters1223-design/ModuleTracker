"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Kept to the everyday three. The app name goes to the Dashboard (home); change
// orders and activity are reached from the Dashboard and each module's page.
const TABS = [
  { href: "/modules", label: "Modules" },
  { href: "/scripts", label: "Scripts" },
  { href: "/tasks", label: "Tasks" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    // overflow-y must be hidden explicitly: overflow-x:auto alone makes the browser
    // treat the tab underline's 1px overhang as vertical overflow and show a scrollbar.
    <div className="flex h-full min-w-0 gap-5 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center border-b-2 text-sm font-medium ${
              active
                ? "border-brand text-brand dark:border-gold dark:text-gold"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
