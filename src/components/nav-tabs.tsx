"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/modules", label: "Modules" },
  { href: "/scripts", label: "Scripts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/changes", label: "Changes" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <div className="flex h-full gap-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center border-b-2 text-sm font-medium ${
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
