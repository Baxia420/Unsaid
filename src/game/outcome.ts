import type { Alignment, OutcomeId, PerceivedImpact, TurnAssessment } from './types';

const constructive = new Set<PerceivedImpact>(['understanding', 'acknowledgment', 'explanation', 'repair']);
const harmful = new Set<PerceivedImpact>(['defense', 'minimization', 'pressure', 'avoidance']);
export function classifyAlignment(intent: string, impact: PerceivedImpact): Alignment {
  const direct: Record<string, PerceivedImpact> = { understand: 'understanding', acknowledge: 'acknowledgment', explain: 'explanation', repair: 'repair' };
  if (direct[intent] === impact) return 'aligned';
  if (harmful.has(impact)) return 'harmful_divergence';
  return 'constructive_divergence';
}
export function evaluateOutcome(input: { assessments: TurnAssessment[]; finalEngagement: number; finalTension: number }): OutcomeId {
  const { assessments, finalEngagement, finalTension } = input;
  const aligned = assessments.filter(a => a.alignment === 'aligned').length;
  const harmfulCount = assessments.filter(a => a.alignment === 'harmful_divergence').length;
  const constructiveCount = assessments.filter(a => constructive.has(a.perceivedImpact)).length;
  const lateHarm = assessments.slice(-4).filter(a => harmful.has(a.perceivedImpact)).length;
  const lateRepair = assessments.slice(-5).filter(a => a.perceivedImpact === 'repair' || a.perceivedImpact === 'acknowledgment').length;
  if (harmfulCount >= 6 || lateHarm >= 3 || (finalTension >= 7 && finalEngagement <= -2)) return 'the_speech';
  if (constructiveCount >= 7 && aligned >= 4 && finalEngagement >= 2 && finalTension <= 5 && lateRepair >= 2) return 'even';
  return 'smoothed';
}
