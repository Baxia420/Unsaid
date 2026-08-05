import { z } from 'zod';
import { SCENARIO } from '../../src/game/scenario';

export const PlayerIntentSchema = z.enum([
  'understand',
  'acknowledge',
  'explain',
  'repair',
]);

export const PerceivedImpactSchema = z.enum([
  'understanding',
  'acknowledgment',
  'explanation',
  'repair',
  'defense',
  'minimization',
  'pressure',
  'avoidance',
  'unclear',
]);

const plainText = (field: string, maxLength: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => value.length > 0 && value.length <= maxLength && !/[<>]/.test(value),
      `${field} must be plain text between 1 and ${maxLength} characters`
    );

const closureSchema = plainText('closing message', 360);

export const FinalClosuresSchema = z.object({
  even: closureSchema,
  smoothed: closureSchema,
  the_speech: closureSchema,
});

export const ModelOutputSchema = z.object({
  characterText: plainText('characterText', 800),
  perceivedImpact: PerceivedImpactSchema,
  impactReason: plainText('impactReason', 180),
  engagementDelta: z
    .number()
    .int()
    .min(SCENARIO.deltaBounds.engagementDelta.min)
    .max(SCENARIO.deltaBounds.engagementDelta.max),
  tensionDelta: z
    .number()
    .int()
    .min(SCENARIO.deltaBounds.tensionDelta.min)
    .max(SCENARIO.deltaBounds.tensionDelta.max),
  finalClosures: FinalClosuresSchema.optional(),
});

export type ValidatedModelOutput = z.infer<typeof ModelOutputSchema>;
