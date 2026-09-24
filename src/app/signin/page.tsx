import type { Metadata } from "next";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Sign in · ModuleTracker" };

const ERRORS: Record<string, string> = {
  AccessDenied: "That Google account isn't on this app's access list. Ask the admin to add it.",
  Configuration: "Sign-in isn't configured correctly on the server.",
};

export default async function SignInPage(props: PageProps<"/signin">) {
  const { error, callbackUrl } = await props.searchParams;
  const redirectTo =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/";
  const message =
    typeof error === "string" ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Use the Google account you were invited with. The app asks for access to the Google Drive
        files it creates, so it can set up scripts for you.
      </p>
      {message && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {message}
        </p>
      )}
      <form
        className="mt-6"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark"
        >
          Continue with Google
        </button>
      </form>
    </main>
  );
}
