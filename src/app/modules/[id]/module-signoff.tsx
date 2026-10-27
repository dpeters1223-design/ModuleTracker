"use client";

import { useState, useTransition } from "react";
import { reopenModule, signOffModule } from "./signoff-actions";

/**
 * The formal sign-off at the top of a module. Deliberately heavier than the rest of
 * the page's controls: it is the one action that declares a module finished, and it
 * asks for confirmation because it posts to Slack and goes in the history.
 *
 * Sign-off is not an archive — the module stays editable afterwards, and the banner
 * says so, because people assume "signed off" means "locked".
 */
export function ModuleSignOff({
  moduleId,
  moduleTitle,
  signedOffAt,
  signedOffBy,
  canSignOff,
}: {
  moduleId: string;
  moduleTitle: string;
  /** Already formatted server-side, in the team's time zone. */
  signedOffAt: string | null;
  signedOffBy: string | null;
  canSignOff: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (signedOffAt) {
    return (
      <div className="rounded-lg border-2 border-green-600 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-green-900 uppercase dark:text-green-200">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Signed off &amp; completed
            </p>
            <p className="mt-1 text-sm text-green-900 dark:text-green-200">
              {signedOffBy ? `${signedOffBy} signed this off` : "Signed off"} on {signedOffAt}. The module can
              still be changed — record anything further as a change order.
            </p>
          </div>
          {canSignOff && (
            <button
              type="button"
              className="shrink-0 text-xs text-green-900/70 underline underline-offset-4 hover:text-green-900 disabled:opacity-50 dark:text-green-200/70 dark:hover:text-green-200"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Reopen "${moduleTitle}"?\n\nThis undoes the sign-off.`)) return;
                startTransition(async () => {
                  const res = await reopenModule(moduleId);
                  if (res.error) setError(res.error);
                });
              }}
            >
              Reopen
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!canSignOff) return null;

  return (
    <div className="rounded-lg border-2 border-brand bg-brand-light p-4 dark:border-gold dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand uppercase dark:text-gold">Final sign-off</p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            Declare this module finished. It stays editable afterwards — this is not an archive.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gold dark:text-brand dark:hover:bg-gold-dark"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Sign off "${moduleTitle}"?\n\nThis marks the module signed off and completed, posts to Slack, ` +
                  `and is recorded in the history. It can be reopened if needed.`
              )
            ) {
              return;
            }
            startTransition(async () => {
              const res = await signOffModule(moduleId);
              if (res.error) setError(res.error);
            });
          }}
        >
          {pending ? "Signing off…" : "Sign off this module"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
