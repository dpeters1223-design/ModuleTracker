"use client";

import { useTransition } from "react";
import { deleteModule } from "@/app/discovery/actions";

export function DeleteModuleButton({ moduleId, name }: { moduleId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      onClick={() => {
        if (
          !confirm(
            `Delete "${name}" and all its scenes and tasks? This can't be undone. Its script stays in Google Drive.`
          )
        )
          return;
        startTransition(async () => {
          await deleteModule(moduleId);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete module"}
    </button>
  );
}
