import { SCENARIO } from './scenario';
import type { SceneMode } from './types';
import type { Beat } from './scenario';

export function getCurrentBeat(turnIndex: number): Beat | null {
  return SCENARIO.beats[turnIndex] ?? null;
}

export function isRehearsalTurn(turnIndex: number): boolean {
  const beat = getCurrentBeat(turnIndex);
  return beat?.isRehearsal ?? false;
}

export function canSubmitTurn(turnIndex: number, mode: SceneMode): boolean {
  return (mode === 'reality' || mode === 'rehearsing') && turnIndex < SCENARIO.totalTurns;
}
