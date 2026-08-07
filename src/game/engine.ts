import { SCENARIO } from './scenario.js';

export function canSubmitTurn(
  turnIndex: number,
  mode: string,
  hasSelectedIntention = true
): boolean {
  return (
    mode === 'playing' &&
    hasSelectedIntention &&
    turnIndex >= 0 &&
    turnIndex < SCENARIO.totalTurns
  );
}
