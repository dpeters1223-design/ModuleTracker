import { prisma } from "@/lib/prisma";
import type { FeatureRequestRow } from "@/components/feature-request-list";

/** Feature requests as rows, newest first. */
export async function getFeatureRequestRows(): Promise<FeatureRequestRow[]> {
  const rows = await prisma.featureRequest.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body ?? "",
    status: r.status,
    submittedByName: r.submittedByName,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));
}
