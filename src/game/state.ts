import type { PortraitState, GameState } from './types';
import { SCENARIO } from './scenario';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function derivePortraitState(
  engagement: number,
  tension: number
): PortraitState {
  if (engagement <= -2 && tension < 4) return 'distant';
  if (tension >= 4 && engagement < 3) return 'defensive';
  if (tension >= 2) return 'hurt_exposed';
  return 'connected';
}

export function applyTurn(
  current: GameState,
  engagementDelta: number,
  tensionDelta: number
): GameState {
  const clampedEngagementDelta = clamp(
    engagementDelta,
    SCENARIO.deltaBounds.engagementDelta.min,
    SCENARIO.deltaBounds.engagementDelta.max
  );
  const clampedTensionDelta = clamp(
    tensionDelta,
    SCENARIO.deltaBounds.tensionDelta.min,
    SCENARIO.deltaBounds.tensionDelta.max
  );

  const newEngagement = clamp(
    current.engagement + clampedEngagementDelta,
    SCENARIO.bounds.engagement.min,
    SCENARIO.bounds.engagement.max
  );
  const newTension = clamp(
    current.tension + clampedTensionDelta,
    SCENARIO.bounds.tension.min,
    SCENARIO.bounds.tension.max
  );

  return {
    engagement: newEngagement,
    tension: newTension,
    portraitState: derivePortraitState(newEngagement, newTension),
  };
}
