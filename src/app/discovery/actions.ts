"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanDiscovery, type DiscoveryInput } from "@/lib/discovery";

export type DiscoveryResult = { errors: string[] };

// TODO(M2): verify the signed-in user here once auth lands — Server Actions are
// reachable by direct POST, not just through the form.
export async function submitDiscovery(input: DiscoveryInput): Promise<DiscoveryResult> {
  const { data, errors } = cleanDiscovery(input);
  if (errors.length) return { errors };

  const opt = (s: string) => s || null;

  const mod = await prisma.module.create({
    data: {
      name: data.name,
      number: opt(data.number),
      status: "pre_production",
      description: data.description,
      audience: opt(data.audience),
      targetCompletion: opt(data.targetCompletion),
      runtimeMinutes: data.runtimeMinutes ? Number(data.runtimeMinutes) : null,
      learningObjectives: opt(data.objectives.join("\n")),
      toolsUsed: opt(data.tools.map((tool) => tool.name).join("\n")),
      // One block per tool ("Tool:\nfeatures"), readable as-is in Prisma Studio
      featuresDiscussed: opt(
        data.tools
          .filter((tool) => tool.features)
          .map((tool) => `${tool.name}:\n${tool.features}`)
          .join("\n\n")
      ),
      scenes: {
        create: data.scenes.map((s, i) => ({
          order: i + 1,
          title: opt(s.title),
          location: opt(s.location),
          backgroundMediaType: opt(s.mediaType),
          speaker: opt(s.speaker),
          toolUsed: opt(s.tool),
          interactionHighlighted: opt(s.interaction),
          activities: opt(s.activities),
          notes: opt(s.notes),
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/");
  redirect(`/modules/${mod.id}?submitted=1`);
}
