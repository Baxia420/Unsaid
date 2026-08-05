import type {
  Alignment,
  OutcomeId,
  PerceivedImpact,
  PlayerIntent,
  TurnAssessment,
} from './types';

const DIRECT_IMPACT: Record<PlayerIntent, PerceivedImpact> = {
  understand: 'understanding',
  acknowledge: 'acknowledgment',
  explain: 'explanation',
  repair: 'repair',
};

const CONSTRUCTIVE_IMPACTS = new Set<PerceivedImpact>([
  'understanding',
  'acknowledgment',
  'explanation',
  'repair',
]);

const HARMFUL_IMPACTS = new Set<PerceivedImpact>([
  'defense',
  'minimization',
  'pressure',
  'avoidance',
]);

export interface OutcomeInputs {
  assessments: TurnAssessment[];
  finalEngagement: number;
  finalTension: number;
}

export function classifyAlignment(
  intention: PlayerIntent,
  impact: PerceivedImpact
): Alignment {
  if (DIRECT_IMPACT[intention] === impact) return 'aligned';
  if (HARMFUL_IMPACTS.has(impact)) return 'harmful_divergence';
  return 'constructive_divergence';
}

export function evaluateOutcome(inputs: OutcomeInputs): OutcomeId {
  const { assessments, finalEngagement, finalTension } = inputs;
  const alignedCount = assessments.filter(
    (assessment) => assessment.alignment === 'aligned'
  ).length;
  const harmfulCount = assessments.filter((assessment) =>
    HARMFUL_IMPACTS.has(assessment.perceivedImpact)
  ).length;
  const constructiveCount = assessments.filter((assessment) =>
    CONSTRUCTIVE_IMPACTS.has(assessment.perceivedImpact)
  ).length;
  const lateHarmCount = assessments
    .slice(-4)
    .filter((assessment) => HARMFUL_IMPACTS.has(assessment.perceivedImpact)).length;
  const lateRepairCount = assessments
    .slice(-5)
    .filter(
      (assessment) =>
        assessment.perceivedImpact === 'repair' ||
        assessment.perceivedImpact === 'acknowledgment'
    ).length;

  if (
    harmfulCount >= 6 ||
    lateHarmCount >= 3 ||
    (finalTension >= 7 && finalEngagement <= -2)
  ) {
    return 'the_speech';
  }

  if (
    constructiveCount >= 7 &&
    alignedCount >= 4 &&
    finalEngagement >= 2 &&
    finalTension <= 5 &&
    lateRepairCount >= 2
  ) {
    return 'even';
  }

  return 'smoothed';
}
