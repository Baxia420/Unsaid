import type { Intent, OutcomeId } from './types';

const REPAIR_INTENTS: Intent[] = ['repair', 'acknowledge'];
const SELF_PROTECTIVE_INTENTS: Intent[] = ['defend', 'minimize', 'redirect', 'pressure'];

export interface OutcomeInputs {
  intents: Intent[];
  finalEngagement: number;
  finalTension: number;
}

export function evaluateOutcome(inputs: OutcomeInputs): OutcomeId {
  const repairCount = inputs.intents.filter((i) => REPAIR_INTENTS.includes(i)).length;
  const selfProtectiveCount = inputs.intents.filter((i) =>
    SELF_PROTECTIVE_INTENTS.includes(i)
  ).length;

  const highlyTense = inputs.finalTension >= 5;
  const nonEngaged = inputs.finalEngagement <= 0;
  const positiveEngagement = inputs.finalEngagement > 0;
  const notHighlyElevatedTension = inputs.finalTension < 5;

  // The Speech if at least three turns are self-protective,
  // OR final state is both highly tense and non-engaged.
  if (selfProtectiveCount >= 3 || (highlyTense && nonEngaged)) {
    return 'the_speech';
  }

  // Even if at least three turns are repair-oriented,
  // final engagement is positive, and final tension is not highly elevated.
  if (repairCount >= 3 && positiveEngagement && notHighlyElevatedTension) {
    return 'even';
  }

  // Smoothed for all remaining valid paths.
  return 'smoothed';
}
