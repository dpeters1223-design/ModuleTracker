import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { auth, signOut } from "@/auth";
import { NavTabs } from "@/components/nav-tabs";
import { notifyUsers, unreadNotifications } from "@/lib/activity-feed";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ModuleTracker",
  description: "Production tracker for VR training modules",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  // Bell only for people set up to be notified (NOTIFY_USERS): count of new updates.
  const bell = email && notifyUsers().includes(email) ? await unreadNotifications(email) : null;
  const navLink =
    "text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {/* Gold-to-teal strip, echoing the lab logo's swirl */}
          <div className="h-1 bg-gradient-to-r from-gold via-gold-dark to-teal" aria-hidden />
          <nav className="mx-auto flex h-14 w-full max-w-6xl items-stretch justify-between gap-6 px-4 sm:px-6">
            <div className="flex min-w-0 items-stretch gap-8">
              <Link href="/" className="flex items-center font-semibold tracking-tight text-brand dark:text-gold">
                ModuleTracker
              </Link>
              {session?.user && <NavTabs />}
            </div>
            {session?.user && (
              <div className="flex shrink-0 items-center gap-4">
                {bell !== null && (
                  <Link
                    href="/activity?watch=1"
                    aria-label={bell ? `${bell} new update${bell === 1 ? "" : "s"} to review` : "Updates to review"}
                    title={bell ? `${bell} new update${bell === 1 ? "" : "s"}` : "No new updates"}
                    className="relative text-zinc-500 hover:text-brand dark:hover:text-gold"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
                    </svg>
                    {bell > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-lab-red px-1 text-center text-[10px] leading-4 font-semibold text-white">
                        {bell > 99 ? "99+" : bell}
                      </span>
                    )}
                  </Link>
                )}
                <Link
                  href="/discovery/new"
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark"
                >
                  + New module
                </Link>
                <span className="hidden text-sm text-zinc-400 xl:inline">{session.user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/signin" });
                  }}
                >
                  <button type="submit" className={navLink}>
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
