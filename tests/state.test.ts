import { describe, expect, it } from 'vitest';
import { applyTurn, clamp, derivePortraitState } from '../src/game/state';
import { SCENARIO } from '../src/game/scenario';

describe('state bounds and portraits', () => {
  it.each([[5,0,10,5],[-5,0,10,0],[20,0,10,10]])('clamps %s to [%s,%s]', (value,min,max,expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });
  it.each([
    [-3, 1, 'distant'], [-2, 3, 'distant'], [-3, 4, 'defensive'],
    [2, 7, 'defensive'], [3, 4, 'hurt_exposed'], [0, 2, 'hurt_exposed'],
    [0, 1, 'connected'], [8, -2, 'connected'],
  ] as const)('maps (%s,%s) to %s', (engagement, tension, portrait) => {
    expect(derivePortraitState(engagement, tension)).toBe(portrait);
  });
  it('opens in a guarded state', () => {
    expect(derivePortraitState(SCENARIO.startingState.engagement, SCENARIO.startingState.tension)).toBe('distant');
  });
  it('clamps per-turn deltas before accumulation', () => {
    const result = applyTurn({ engagement: 0, tension: 0, portraitState: 'connected' }, 99, -99);
    expect(result).toMatchObject({ engagement: 3, tension: -3 });
  });
  it('clamps accumulated axes', () => {
    const result = applyTurn({ engagement: 10, tension: -10, portraitState: 'connected' }, 3, -3);
    expect(result).toMatchObject({ engagement: 10, tension: -10 });
  });
  it('derives portrait from accumulated state, not intention', () => {
    const result = applyTurn({ engagement: -3, tension: 3, portraitState: 'distant' }, 0, 2);
    expect(result.portraitState).toBe('defensive');
  });
});
