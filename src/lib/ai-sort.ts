import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { FeedbackCategory } from "@prisma/client";

const CATEGORIES = ["instructional_design", "ui_ux", "media", "tags"] as const satisfies readonly FeedbackCategory[];

const SortSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).describe("Every category this write-up touches on, zero or more."),
});

let client: Anthropic | null = null;

/**
 * Classifies a playthrough write-up into the fixed feedback categories, via the
 * "AI Sort" button — a manual action, never run automatically on submit. Low-stakes
 * classification, so low effort: this is a simple read, not a reasoning task.
 */
export async function sortFeedback(body: string): Promise<FeedbackCategory[]> {
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(SortSchema) },
    system:
      "You sort playtest/instructional feedback into categories: instructional_design (learning " +
      "objectives, pacing, content accuracy), ui_ux (navigation, controls, interface clarity), " +
      "media (images, video, audio, 3D assets), tags (Uptale tag/dependency logic — things firing " +
      "out of order, missing or broken triggers). A write-up can touch more than one, or none.",
    messages: [{ role: "user", content: body.slice(0, 20_000) }],
  });
  return response.parsed_output?.categories ?? [];
}
