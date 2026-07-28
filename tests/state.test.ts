import { describe, it, expect } from 'vitest';
import { clamp, derivePortraitState, applyTurn } from '../src/game/state';
import { SCENARIO } from '../src/game/scenario';

describe('clamp', () => {
  it('clamps to min', () => {
    expect(clamp(-100, -10, 10)).toBe(-10);
  });

  it('clamps to max', () => {
    expect(clamp(100, -10, 10)).toBe(10);
  });

  it('allows values within range', () => {
    expect(clamp(5, -10, 10)).toBe(5);
  });
});

describe('derivePortraitState', () => {
  it('returns distant for low engagement + low tension', () => {
    expect(derivePortraitState(-5, 0)).toBe('distant');
    expect(derivePortraitState(-1, 2)).toBe('distant');
  });

  it('returns defensive for low engagement + high tension', () => {
    expect(derivePortraitState(-5, 5)).toBe('defensive');
    expect(derivePortraitState(-1, 3)).toBe('defensive');
  });

  it('returns hurt_exposed for high engagement + high tension', () => {
    expect(derivePortraitState(0, 5)).toBe('hurt_exposed');
    expect(derivePortraitState(3, 3)).toBe('hurt_exposed');
  });

  it('returns connected for high engagement + low tension', () => {
    expect(derivePortraitState(3, 0)).toBe('connected');
    expect(derivePortraitState(0, 0)).toBe('connected');
  });
});

describe('applyTurn', () => {
  const baseState = {
    engagement: 0,
    tension: 0,
    portraitState: 'connected' as const,
  };

  it('applies valid deltas and updates state', () => {
    const result = applyTurn(baseState, 3, 0);
    expect(result.engagement).toBe(3);
    expect(result.tension).toBe(0);
    expect(result.portraitState).toBe('connected');
  });

  it('clamps deltas to configured bounds', () => {
    const result = applyTurn(baseState, 100, -100);
    expect(result.engagement).toBe(SCENARIO.deltaBounds.engagementDelta.max);
    expect(result.tension).toBe(SCENARIO.deltaBounds.tensionDelta.min);
  });

  it('clamps accumulated state to bounds', () => {
    const nearMax = {
      engagement: 9,
      tension: -9,
      portraitState: 'connected' as const,
    };
    const result = applyTurn(nearMax, 5, -5);
    expect(result.engagement).toBe(SCENARIO.bounds.engagement.max);
    expect(result.tension).toBe(SCENARIO.bounds.tension.min);
  });
});
