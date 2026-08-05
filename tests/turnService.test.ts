import { describe, expect, it, vi } from 'vitest';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { makeFallback, processTurn } from '../server/turn/service';
import { SCENARIO } from '../src/game/scenario';
import { CLOSURES, makeModelOutput, makeRequest } from './helpers';

function adapter(output: unknown, throws = false): ModelAdapter {
  return {
    generateTurn: vi.fn(async () => {
      if (throws) throw new Error('provider secret should not escape');
      return output;
    }),
  };
}

describe('turn service', () => {
  it('returns validated primary output', async () => {
    const result = await processTurn(makeRequest(), adapter(makeModelOutput()));
    expect(result.characterText).toContain('door');
    expect(result.assessment.perceivedImpact).toBe('understanding');
  });
  it('uses recovery for invalid primary output', async () => {
    const primary = adapter({ invalid: true });
    const recovery = adapter(makeModelOutput({ characterText: 'Recovered.' }));
    expect((await processTurn(makeRequest(), primary, recovery)).characterText).toBe('Recovered.');
    expect(recovery.generateTurn).toHaveBeenCalledOnce();
  });
  it('uses recovery for a thrown primary error', async () => {
    const recovery = adapter(makeModelOutput({ characterText: 'Safe.' }));
    expect((await processTurn(makeRequest(), adapter(null, true), recovery)).characterText).toBe('Safe.');
  });
  it('falls back if recovery is invalid', async () => {
    const result = await processTurn(makeRequest(), adapter(null, true), adapter({ bad: true }));
    expect(result.characterText).toBe(SCENARIO.fallbackCharacterLine);
  });
  it('does not recurse when primary and recovery are identical', async () => {
    const broken = adapter(null, true);
    await processTurn(makeRequest(), broken, broken);
    expect(broken.generateTurn).toHaveBeenCalledOnce();
  });
  it('returns no closures on ordinary turns', async () => {
    expect((await processTurn(makeRequest({ turnIndex: 13 }), adapter(makeModelOutput({ finalClosures: CLOSURES })))).finalClosures).toBeUndefined();
  });
  it('returns validated closures on turn 15', async () => {
    const result = await processTurn(makeRequest({ turnIndex: 14 }), adapter(makeModelOutput({ finalClosures: CLOSURES })));
    expect(result.finalClosures).toEqual(CLOSURES);
  });
  it('uses fallback closures when turn-15 closures are missing', async () => {
    const result = await processTurn(makeRequest({ turnIndex: 14 }), adapter(makeModelOutput()));
    expect(result.finalClosures).toEqual(SCENARIO.fallbackClosures);
  });
  it('makes only one model request for a valid final turn', async () => {
    const primary = adapter(makeModelOutput({ finalClosures: CLOSURES }));
    await processTurn(makeRequest({ turnIndex: 14 }), primary);
    expect(primary.generateTurn).toHaveBeenCalledOnce();
  });
  it('derives portrait after clamped state application', async () => {
    const result = await processTurn(
      makeRequest({ state: { engagement: 10, tension: 3 } }),
      adapter(makeModelOutput({ engagementDelta: 3, tensionDelta: 3 }))
    );
    expect(result.presentation.portraitState).toBe('hurt_exposed');
  });
  it('ignores provider-selected portrait and outcome fields', async () => {
    const output = { ...makeModelOutput(), portraitState: 'connected', outcome: 'even' };
    const result = await processTurn(makeRequest(), adapter(output));
    expect(result).not.toHaveProperty('outcome');
    expect(result.presentation.portraitState).not.toBe('connected');
  });
  it('fallback is playable and outcome-free', () => {
    const result = makeFallback(makeRequest());
    expect(result.characterText.length).toBeGreaterThan(0);
    expect(result.assessment).toMatchObject({ perceivedImpact: 'unclear', engagementDelta: 0, tensionDelta: 0 });
    expect(result).not.toHaveProperty('outcome');
  });
  it.each([[-4, 0], [4, 0], [0, 4]])('rejects invalid deltas %s/%s before client', async (engagementDelta, tensionDelta) => {
    const result = await processTurn(makeRequest(), adapter(makeModelOutput({ engagementDelta, tensionDelta })));
    expect(result.assessment).toMatchObject({ engagementDelta: 0, tensionDelta: 0 });
  });
});
