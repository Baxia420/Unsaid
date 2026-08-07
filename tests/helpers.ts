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
import { createNarrativeState } from '../src/game/narrative';

export const CLOSURES: FinalClosures = {
  even: 'We can speak again, but slowly.',
  smoothed: 'Let us leave it here today.',
  the_speech: "You're not a terrible person. I know you did not mean to hurt me.",
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
  const narrativeState = createNarrativeState();
  return {
    characterText: 'I kept looking at the door.',
    assessment: {
      perceivedImpact: 'understanding',
      impactReason: 'The question made room for their experience.',
      engagementDelta: 1,
      tensionDelta: -1,
    },
    presentation: { portraitState: 'distant' },
    narrative: {
      state: narrativeState,
      meta: {
        turnIndex: 0,
        primarySceneMove: 'answer',
        targetLength: 'medium',
        offeredMemoryId: null,
        revealedMemoryId: null,
        activeBeliefBefore: 'i_did_not_matter',
        activeBeliefAfter: 'i_did_not_matter',
        genuineQuestion: 'experience',
      },
    },
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

export function detectSuspiciousEcho(playerText: string, characterText: string): boolean {
  if (playerText.trim().split(/\s+/).length < 5) return false;

  const normalize = (text: string) => text.toLowerCase()
    .replace(/[.,!?]/g, '')
    .replace(/\b(i|me)\b/g, 'you')
    .replace(/\bmy\b/g, 'your')
    .replace(/\bam\b/g, 'are')
    .trim();

  if (characterText.trim().split(/\s+/).length <= 3 && characterText.includes('?')) return false;

  const playerWords = normalize(playerText).split(/\s+/);
  const characterWords = normalize(characterText).split(/\s+/);

  const stopWords = new Set(['you', 'it', 'the', 'and', 'to', 'a', 'of', 'in', 'that', 'is', 'was', 'your', 'but', 'not', 'we', 'are', 'what', 'do', 'don\'t', 'did', 'didn\'t', 'know', 'think', 'for']);
  const contextNouns = new Set(['exhibition', 'cafe', 'photographs']);

  let maxConsecutiveMatch = 0;
  for (let i = 0; i <= playerWords.length - 5; i++) {
    for (let j = 0; j <= characterWords.length - 5; j++) {
      let matchCount = 0;
      let meaningfulCount = 0;
      while (
        i + matchCount < playerWords.length &&
        j + matchCount < characterWords.length &&
        playerWords[i + matchCount] === characterWords[j + matchCount]
      ) {
        const word = playerWords[i + matchCount];
        if (!stopWords.has(word) && !contextNouns.has(word)) {
          meaningfulCount++;
        }
        matchCount++;
      }

      if (matchCount >= 5 && meaningfulCount >= 1) {
        maxConsecutiveMatch = Math.max(maxConsecutiveMatch, matchCount);
      }
    }
  }

  return maxConsecutiveMatch >= 5;
}
