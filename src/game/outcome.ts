import type {
  Alignment,
  FinalClosures,
  OutcomeId,
  PerceivedImpact,
  PlayerIntent,
  TurnAssessment,
} from './types.js';
import type { NarrativeState } from './narrative.js';
import { isFriendComfortingPlayer } from './narrative.js';
import { SCENARIO } from './scenario.js';

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
  narrativeState: NarrativeState;
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
  const { assessments, finalEngagement, finalTension, narrativeState } = inputs;
  const alignedCount = assessments.filter((assessment) => assessment.alignment === 'aligned').length;
  const constructiveCount = assessments.filter((assessment) => CONSTRUCTIVE_IMPACTS.has(assessment.perceivedImpact)).length;
  const lateRepairCount = assessments.slice(-4).filter(
    (assessment) => assessment.perceivedImpact === 'repair' || assessment.perceivedImpact === 'acknowledgment'
  ).length;
  const evidence = narrativeState.outcomeEvidence;

  if (
    evidence.friendComfortMoveCount >= 1 &&
    (evidence.playerCenteredGuiltCount >= 1 || evidence.reassurancePressureCount >= 1)
  ) {
    return 'the_speech';
  }

  const beliefSupportsEven = ['they_cared_but_failed_me', 'repair_might_be_possible'].includes(narrativeState.activeBelief);
  if (
    constructiveCount >= 5 &&
    alignedCount >= 3 &&
    finalEngagement > 0 &&
    finalTension <= 5 &&
    lateRepairCount >= 2 &&
    narrativeState.revealedMemoryIds.length >= 1 &&
    beliefSupportsEven
  ) {
    return 'even';
  }

  return 'smoothed';
}

function closureIsConsistent(outcomeId: OutcomeId, closure: string): boolean {
  if (outcomeId === 'the_speech') return isFriendComfortingPlayer(closure);
  if (/\b(?:i forgive you|we(?:'re| are) okay|it(?:'s| is) fine)\b/i.test(closure)) return false;
  if (outcomeId === 'even') return /\b(?:honest|talk|speak|try|slowly|again|not sure|first time)\b/i.test(closure);
  return /\b(?:leave|finish|end|space|distance|today|goodbye|not ready|here)\b/i.test(closure);
}

export function selectOutcomeClosure(
  outcomeId: OutcomeId,
  generatedClosures?: FinalClosures
): string {
  const candidate = generatedClosures?.[outcomeId];
  return candidate && closureIsConsistent(outcomeId, candidate)
    ? candidate
    : SCENARIO.fallbackClosures[outcomeId];
}
