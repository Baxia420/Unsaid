import { z } from 'zod';
import { SCENARIO } from '../../src/game/scenario';

export const IntentSchema = z.enum([
  "acknowledge",
  "defend",
  "minimize",
  "redirect",
  "repair",
  "pressure",
  "unclear",
]);

export const ModelOutputSchema = z.object({
  characterText: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0 && s.length <= 2000, {
      message: 'characterText must contain at least one non-whitespace character and be no more than 2000 characters',
    }),
  assessment: z.object({
    intent: IntentSchema,
    engagementDelta: z.number()
      .min(SCENARIO.deltaBounds.engagementDelta.min)
      .max(SCENARIO.deltaBounds.engagementDelta.max),
    tensionDelta: z.number()
      .min(SCENARIO.deltaBounds.tensionDelta.min)
      .max(SCENARIO.deltaBounds.tensionDelta.max),
  }),
});

export type ValidatedModelOutput = z.infer<typeof ModelOutputSchema>;
