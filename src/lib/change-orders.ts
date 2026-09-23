import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moduleTitle } from "@/lib/script-template";
import type { ChangeOrderRow } from "@/components/change-order-list";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Change orders as form-ready rows, newest first, labeled with their module. */
export async function getChangeOrderRows(where: Prisma.ChangeOrderWhereInput = {}): Promise<ChangeOrderRow[]> {
  const rows = await prisma.changeOrder.findMany({
    where,
    include: { module: { select: { number: true, name: true } } },
    orderBy: [{ suggestedDate: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    moduleId: c.moduleId ?? "",
    moduleLabel: c.module ? moduleTitle(c.module) : null,
    description: c.description,
    sceneRef: c.sceneRef ?? "",
    status: c.status,
    suggestedBy: c.suggestedBy ?? "",
    suggestedDate: day(c.suggestedDate),
    goalDate: day(c.goalDate),
    approvedBy: c.approvedBy ?? "",
    completedDate: day(c.completedDate),
    versionUpdated: c.versionUpdated,
    notes: c.notes ?? "",
  }));
}

/** Module choices for the change order form. */
export async function getModuleOptions() {
  const modules = await prisma.module.findMany({
    select: { id: true, number: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  return modules.map((m) => ({ id: m.id, label: moduleTitle(m) }));
}
