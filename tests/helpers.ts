import type {
  FinalClosures,
  ModelOutput,
  PerceivedImpact,
  PlayerIntent,
  TurnAssessment,
  TurnRequest,
  TurnResponse,
} from '../src/game/types';
import { SCENARIO } from '../src/game/scenario';

export const CLOSURES: FinalClosures = {
  even: 'We can speak again, but slowly.',
  smoothed: 'Let us leave it here today.',
  the_speech: 'I need to go now.',
};

export function makeRequest(overrides: Partial<TurnRequest> = {}): TurnRequest {
  return {
    scenarioId: SCENARIO.id,
    turnIndex: 0,
    playerText: 'I want to understand what hurt.',
    selectedIntention: 'understand',
    state: { ...SCENARIO.startingState },
    recentTranscript: [{ speaker: 'character', text: SCENARIO.openingLine }],
    ...overrides,
  };
}

export function makeModelOutput(
  overrides: Partial<ModelOutput> = {}
): ModelOutput {
  return {
    characterText: 'I kept looking at the door.',
    perceivedImpact: 'understanding',
    impactReason: 'The question made room for their experience.',
    engagementDelta: 1,
    tensionDelta: -1,
    ...overrides,
  };
}

export function makeTurnResponse(
  overrides: Partial<TurnResponse> = {}
): TurnResponse {
  return {
    characterText: 'I kept looking at the door.',
    assessment: {
      perceivedImpact: 'understanding',
      impactReason: 'The question made room for their experience.',
      engagementDelta: 1,
      tensionDelta: -1,
    },
    presentation: { portraitState: 'distant' },
    ...overrides,
  };
}

export function makeAssessment(
  perceivedImpact: PerceivedImpact,
  selectedIntent: PlayerIntent = 'acknowledge'
): TurnAssessment {
  const constructive = [
    'understanding',
    'acknowledgment',
    'explanation',
    'repair',
  ].includes(perceivedImpact);
  return {
    selectedIntent,
    perceivedImpact,
    impactReason: 'A bounded reason.',
    alignment: constructive ? 'aligned' : 'harmful_divergence',
    engagementDelta: 0,
    tensionDelta: 0,
  };
}
