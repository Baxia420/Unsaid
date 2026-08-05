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
});

export type ValidatedTurnRequest = z.infer<typeof TurnRequestSchema>;
