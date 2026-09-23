import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

/** One module with its scenes, deduplicated per request (layout + tab page share it). */
export const getModule = cache(async (id: string) => {
  await connection();
  return prisma.module.findUnique({
    where: { id },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
});
