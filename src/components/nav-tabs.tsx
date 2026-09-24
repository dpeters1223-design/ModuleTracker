"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/modules", label: "Modules" },
  { href: "/scripts", label: "Scripts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/changes", label: "Changes" },
  { href: "/activity", label: "Activity" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <div className="flex h-full min-w-0 gap-5 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
