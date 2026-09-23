"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModuleTabs({ moduleId }: { moduleId: string }) {
  const pathname = usePathname();
  const base = `/modules/${moduleId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/script`, label: "Script" },
  ];

  return (
    <nav className="flex gap-6 border-b border-zinc-200 dark:border-zinc-800" aria-label="Module sections">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
              active
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
