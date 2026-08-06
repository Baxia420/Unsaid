import { z } from 'zod';
import { SCENARIO } from '../../src/game/scenario';
import { PlayerIntentSchema } from './schema';

export const TranscriptEntrySchema = z.object({
  speaker: z.enum(['player', 'character']),
  text: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0 && value.length <= 800),
});

export const TurnRequestSchema = z.object({
  scenarioId: z.literal(SCENARIO.id),
  turnIndex: z.number().int().min(0).max(SCENARIO.totalTurns - 1),
  playerText: z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => value.length > 0 && value.length <= SCENARIO.maxPlayerTextLength
    ),
  selectedIntention: PlayerIntentSchema,
  state: z.object({
    engagement: z
      .number()
      .finite()
      .min(SCENARIO.bounds.engagement.min)
      .max(SCENARIO.bounds.engagement.max),
    tension: z
      .number()
      .finite()
      .min(SCENARIO.bounds.tension.min)
      .max(SCENARIO.bounds.tension.max),
  }),
  recentTranscript: z
    .array(TranscriptEntrySchema)
    .max(SCENARIO.totalTurns * 2 + 1),
  narrativeState: z.object({
    revealedMemoryIds: z.array(z.string().max(64)).max(20),
    recentSceneMoves: z.array(z.enum(['answer', 'react', 'ask', 'challenge', 'reveal_memory', 'recall_relationship', 'soften', 'set_boundary', 'withdraw'])).max(4),
    activeBelief: z.enum(['i_did_not_matter', 'they_cared_but_failed_me', 'they_want_relief', 'repair_might_be_possible', 'i_am_not_ready']),
    softeningEvidence: z.number().int().min(0).max(5),
    unresolvedQuestion: z.string().max(240).nullable(),
  }).optional(),
});

export type ValidatedTurnRequest = z.infer<typeof TurnRequestSchema>;
