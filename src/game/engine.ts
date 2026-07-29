import { SCENARIO } from './scenario';
import type { ScenePhase } from './types';
import type { Beat } from './scenario';

export function getCurrentBeat(turnIndex: number): Beat | null {
  return SCENARIO.beats[turnIndex] ?? null;
}

export function isRehearsalTurn(turnIndex: number): boolean {
  const beat = getCurrentBeat(turnIndex);
  return beat?.isRehearsal ?? false;
}

export function canSubmitTurn(turnIndex: number, phase: ScenePhase): boolean {
  return phase === 'playing' && turnIndex < SCENARIO.totalTurns;
}
