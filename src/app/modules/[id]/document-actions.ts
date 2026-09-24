"use server";

import { changed } from "@/lib/changed";
import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";

export type DocumentResult = { errors?: string[] };

export async function addDocumentLink(
  moduleId: string,
  input: { type: string; label: string; url: string }
): Promise<DocumentResult> {
  const user = await requireUser();
  const errors: string[] = [];
  const label = (input.label ?? "").trim();
  if (!(input.type in DOCUMENT_TYPE_LABELS)) errors.push("Pick a document type.");
  if (label.length > 200) errors.push("The label is too long.");

  let url: URL | null = null;
  try {
    url = new URL((input.url ?? "").trim());
  } catch {
    errors.push("Paste the full link, starting with https://");
  }
  if (url && url.protocol !== "https:") errors.push("The link must start with https://");
  if (errors.length || !url) return { errors };

  await prisma.documentLink.create({
    data: {
      moduleId,
      type: input.type as DocumentType,
      label: label || null,
      url: url.href,
      addedById: user.id,
    },
  });
  changed();
  return {};
}

/** Removes the link from the module. The document itself is untouched. */
export async function removeDocumentLink(moduleId: string, linkId: string): Promise<DocumentResult> {
  await requireUser();
  // Scripts are unlinked from the Scripts tab, not here.
  await prisma.documentLink.deleteMany({ where: { id: linkId, moduleId, type: { not: "script" } } });
  changed();
  return {};
}
