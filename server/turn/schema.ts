import { z } from 'zod';
import { SCENARIO } from '../../src/game/scenario';
export const PlayerIntentSchema=z.enum(['understand','acknowledge','explain','repair']);
export const PerceivedImpactSchema=z.enum(['understanding','acknowledgment','explanation','repair','defense','minimization','pressure','avoidance','unclear']);
const reason=z.string().transform(s=>s.trim()).refine(s=>s.length>0&&s.length<=180&&!/[<>]/.test(s), 'impactReason must be plain text up to 180 characters');
const closure=z.string().transform(s=>s.trim()).refine(s=>s.length>0&&s.length<=360&&!/[<>]/.test(s));
export const FinalClosuresSchema=z.object({even:closure,smoothed:closure,the_speech:closure});
export const ModelOutputSchema=z.object({
  characterText:z.string().transform(s=>s.trim()).refine(s=>s.length>0&&s.length<=800), perceivedImpact:PerceivedImpactSchema, impactReason:reason,
  engagementDelta:z.number().int().min(SCENARIO.deltaBounds.engagementDelta.min).max(SCENARIO.deltaBounds.engagementDelta.max),
  tensionDelta:z.number().int().min(SCENARIO.deltaBounds.tensionDelta.min).max(SCENARIO.deltaBounds.tensionDelta.max),
  finalClosures:FinalClosuresSchema.optional()
});
export type ValidatedModelOutput=z.infer<typeof ModelOutputSchema>;
