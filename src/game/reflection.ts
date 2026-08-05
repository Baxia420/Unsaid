import type {
  Intent,
  OutcomeId,
  TranscriptEntry,
  TurnAssessment,
} from './types';

export interface OutcomeReflection {
  quote: string;
  explanation: string;
}

const REPAIR_INTENTS: Intent[] = ['repair', 'acknowledge'];
const SELF_PROTECTIVE_INTENTS: Intent[] = [
  'defend',
  'minimize',
  'redirect',
  'pressure',
];

function preferredIntents(outcomeId: OutcomeId): Intent[] {
  if (outcomeId === 'even') return REPAIR_INTENTS;
  if (outcomeId === 'the_speech') return SELF_PROTECTIVE_INTENTS;
  return ['unclear', ...SELF_PROTECTIVE_INTENTS, ...REPAIR_INTENTS];
}

function explanationFor(outcomeId: OutcomeId): string {
  if (outcomeId === 'even') {
    return 'This mattered because you stayed with their hurt instead of asking them to erase your guilt.';
  }
  if (outcomeId === 'the_speech') {
    return 'This mattered because the apology turned back toward your own discomfort.';
  }
  return 'This mattered because the hard truth remained just outside the words you chose.';
}

/**
 * Selects one real player line without asking the model to interpret the ending.
 * The latest line matching the outcome's intent family wins; otherwise the
 * latest player line is used. Transcript and assessments are aligned by turn.
 */
export function buildOutcomeReflection(
  outcomeId: OutcomeId,
  transcript: TranscriptEntry[],
  assessments: TurnAssessment[]
): OutcomeReflection {
  const playerLines = transcript.filter((entry) => entry.speaker === 'player');
  const preferred = preferredIntents(outcomeId);

  let selectedIndex = -1;
  for (let index = Math.min(playerLines.length, assessments.length) - 1; index >= 0; index -= 1) {
    if (preferred.includes(assessments[index].intent)) {
      selectedIndex = index;
      break;
    }
  }

  const selected = playerLines[selectedIndex] ?? playerLines[playerLines.length - 1];

  return {
    quote: selected?.text ?? '',
    explanation: explanationFor(outcomeId),
  };
}
