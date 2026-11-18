import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { FeedbackCategory } from "@prisma/client";

const CATEGORIES = ["instructional_design", "ui_ux", "media", "tags"] as const satisfies readonly FeedbackCategory[];

export type FeedbackTag = { quote: string; category: FeedbackCategory };
export type SortedFeedback = { categories: FeedbackCategory[]; tags: FeedbackTag[] };

const SortSchema = z.object({
  tags: z
    .array(
      z.object({
        quote: z.string().describe("Copied EXACTLY, word-for-word, from the write-up — a short phrase or sentence, not a paraphrase."),
        category: z.enum(CATEGORIES),
      })
    )
    .describe("Every specific phrase worth flagging, each with the one category it belongs to. Can be empty."),
});

let client: Anthropic | null = null;

/**
 * Finds the specific phrases in a playthrough write-up worth flagging and tags
 * each with a category — via the "AI Sort" button, a manual action, never run
 * automatically on submit. `quote` must come back verbatim so the caller can
 * locate it in `body` and highlight it; a quote that doesn't actually appear in
 * the text is dropped rather than shown wrong (see dependency-graph's category
 * logic for the same "drop what can't be trusted" approach).
 */
export async function sortFeedback(body: string): Promise<SortedFeedback> {
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    output_config: { effort: "medium", format: zodOutputFormat(SortSchema) },
    system:
      "You read playtest/instructional feedback and flag the specific phrases worth calling out, each " +
      "tagged with one category: instructional_design (learning objectives, pacing, content accuracy), " +
      "ui_ux (navigation, controls, interface clarity), media (images, video, audio, 3D assets), tags " +
      "(Uptale tag/dependency logic — things firing out of order, missing or broken triggers). Quote " +
      "each phrase exactly as it appears in the text — do not paraphrase or summarize it. Keep quotes " +
      "short (a clause or sentence). Skip generic remarks that don't fit a category.",
    messages: [{ role: "user", content: body.slice(0, 20_000) }],
  });

  const rawTags = response.parsed_output?.tags ?? [];
  // Keep only quotes that actually occur in the text, and resolve to the FIRST
  // occurrence — that's what the renderer highlights.
  const tags = rawTags.filter((t) => t.quote.trim() && body.includes(t.quote));
  const categories = [...new Set(tags.map((t) => t.category))];
  return { categories, tags };
}

const TagSchema = z.object({ quote: z.string(), category: z.enum(CATEGORIES) });

/** Reads the `tags` JSON column back out — malformed/legacy rows just come back empty. */
export function parseFeedbackTags(value: unknown): FeedbackTag[] {
  const parsed = z.array(TagSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
