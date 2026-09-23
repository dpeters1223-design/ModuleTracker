import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { auth, signOut } from "@/auth";
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
          <nav className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-semibold tracking-tight">
              ModuleTracker
            </Link>
            {session?.user && (
              <div className="flex items-center gap-4">
                <Link href="/discovery/new" className={navLink}>
                  Discovery Form
                </Link>
                <span className="hidden text-sm text-zinc-400 sm:inline">{session.user.email}</span>
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
