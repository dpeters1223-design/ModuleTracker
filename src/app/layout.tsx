import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { auth, signOut } from "@/auth";
import { NavTabs } from "@/components/nav-tabs";
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
          <nav className="mx-auto flex h-14 w-full max-w-4xl items-stretch justify-between gap-6 px-4 sm:px-6">
            <div className="flex items-stretch gap-8">
              <Link href="/" className="flex items-center font-semibold tracking-tight text-brand dark:text-gold">
                ModuleTracker
              </Link>
              {session?.user && <NavTabs />}
            </div>
            {session?.user && (
              <div className="flex items-center gap-4">
                <Link
                  href="/discovery/new"
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark"
                >
                  + New module
                </Link>
                <span className="hidden text-sm text-zinc-400 md:inline">{session.user.email}</span>
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
