import { describe, expect, it, vi } from 'vitest';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { makeFallback, processTurn, processTurnDetailed } from '../server/turn/service';
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

describe('turn service detailed execution', () => {
  it('reports source=gemini on success', async () => {
    const result = await processTurnDetailed(makeRequest(), adapter(makeModelOutput()));
    expect(result.source).toBe('gemini');
    expect(result.recoveryUsed).toBe(false);
    expect(result.failureCategory).toBeUndefined();
  });
  it('reports source=recorded-recovery when recovery succeeds', async () => {
    const primary = adapter({ invalid: true });
    const recovery = adapter(makeModelOutput({ characterText: 'Recovered.' }));
    const result = await processTurnDetailed(makeRequest(), primary, recovery);
    expect(result.source).toBe('recorded-recovery');
    expect(result.recoveryUsed).toBe(true);
    expect(result.failureCategory).toBeDefined();
  });
  it('reports source=deterministic-fallback when everything fails', async () => {
    const result = await processTurnDetailed(makeRequest(), adapter(null, true), adapter({ bad: true }));
    expect(result.source).toBe('deterministic-fallback');
    expect(result.recoveryUsed).toBe(false);
    expect(result.failureCategory).toBeDefined();
  });
  it('reports failure category for HTTP errors', async () => {
    const httpAdapter: ModelAdapter = {
      generateTurn: vi.fn(async () => {
        const err = new Error('Gemini returned HTTP 429');
        (err as unknown as Record<string, unknown>).status = 429;
        throw err;
      }),
    };
    const result = await processTurnDetailed(makeRequest(), httpAdapter);
    expect(result.source).toBe('deterministic-fallback');
    expect(result.failureCategory).toBe('HTTP_429');
    expect(result.retryable).toBe(true);
  });
  it('reports failure category for schema invalid', async () => {
    const result = await processTurnDetailed(makeRequest(), adapter({ invalid: true }));
    expect(result.source).toBe('deterministic-fallback');
    expect(result.failureCategory).toBe('SCHEMA_INVALID');
    expect(result.retryable).toBe(false);
  });
  it('does not recurse when primary and recovery are identical', async () => {
    const broken = adapter(null, true);
    const result = await processTurnDetailed(makeRequest(), broken, broken);
    expect(broken.generateTurn).toHaveBeenCalledOnce();
    expect(result.source).toBe('deterministic-fallback');
  });
});

describe('categorizeAdapterError', () => {
  it.each([
    [400, 'HTTP_400', false],
    [401, 'HTTP_401', false],
    [403, 'HTTP_403', false],
    [404, 'HTTP_404', false],
    [429, 'HTTP_429', true],
    [500, 'HTTP_5XX', true],
    [503, 'HTTP_5XX', true],
  ])('categorizes status %i as %s with retryable=%s', async (status, category, retryable) => {
    const { categorizeAdapterError } = await import('../server/turn/service');
    const { GeminiHttpError } = await import('../server/adapters/GeminiModelAdapter');
    const err = new GeminiHttpError(status, `HTTP ${status}`, status === 429 ? 10 : undefined, 'REASON_CODE');
    const cat = categorizeAdapterError(err);
    expect(cat.category).toBe(category);
    expect(cat.retryable).toBe(retryable);
    expect(cat.status).toBe(status);
    if (status === 429) expect(cat.retryAfter).toBe(10);
    expect(cat.causeCode).toBe('REASON_CODE');
    expect(cat.category).not.toBe('UNKNOWN_PROVIDER_ERROR');
  });

  it.each([
    ['timed out after 15000ms', 'TIMEOUT', true],
    ['fetch failed', 'NETWORK_ERROR', true],
    ['network error occurred', 'NETWORK_ERROR', true],
    ['invalid json in body', 'INVALID_JSON', false],
    ['empty content returned', 'EMPTY_CONTENT', true],
  ])('categorizes message "%s" as %s', async (msg, category, retryable) => {
    const { categorizeAdapterError } = await import('../server/turn/service');
    const err = new Error(msg);
    const cat = categorizeAdapterError(err);
    expect(cat.category).toBe(category);
    expect(cat.retryable).toBe(retryable);
    expect(cat.category).not.toBe('UNKNOWN_PROVIDER_ERROR');
  });
});
