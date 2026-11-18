// Shared with the client (src/app/chat/message-list.tsx), so no "server-only"
// here — split out of chat.ts purely to keep that import safe for a Client Component.
import type { ChatReactionKind } from "@prisma/client";

/** The four fixed reactions, in display order — not an open emoji picker. */
export const REACTION_KINDS = ["thumbs_up", "thumbs_down", "heart", "dog"] as const satisfies readonly ChatReactionKind[];

export type ReactionCount = { count: number; mine: boolean; names: string[] };
/** One count per fixed reaction kind — always all four keys, zero-filled when unused. */
export type ReactionSummary = Record<ChatReactionKind, ReactionCount>;

export const emptyReactions = (): ReactionSummary => ({
  thumbs_up: { count: 0, mine: false, names: [] },
  thumbs_down: { count: 0, mine: false, names: [] },
  heart: { count: 0, mine: false, names: [] },
  dog: { count: 0, mine: false, names: [] },
});
