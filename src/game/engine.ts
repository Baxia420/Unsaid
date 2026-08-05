import { SCENARIO } from './scenario';
export function canSubmitTurn(turnIndex: number, mode: string, hasIntent = true): boolean {
  return mode === 'playing' && hasIntent && turnIndex < SCENARIO.totalTurns;
}
