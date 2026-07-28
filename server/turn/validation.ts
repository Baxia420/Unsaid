import { z } from 'zod';
import { SCENARIO } from '../../src/game/scenario';

export const TranscriptEntrySchema = z.object({
  speaker: z.enum(['player', 'character']),
  text: z.string().min(1).max(2000),
});

export const TurnRequestSchema = z.object({
  scenarioId: z.literal(SCENARIO.id),
  turnIndex: z.number().int().min(0),
  playerText: z
    .string()
    .transform((s) => s.trim())
    .refine(
      (s) => s.length > 0 && s.length <= SCENARIO.maxPlayerTextLength,
      {
        message: `playerText must be non-empty and no more than ${SCENARIO.maxPlayerTextLength} characters after trimming`,
      }
    ),
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
    .max(50),
});

export type ValidatedTurnRequest = z.infer<typeof TurnRequestSchema>;
