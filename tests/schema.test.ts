import { describe, expect, it } from 'vitest';
import {
  FinalClosuresSchema,
  ModelOutputSchema,
  PerceivedImpactSchema,
  PlayerIntentSchema,
} from '../server/turn/schema';
import { TurnRequestSchema } from '../server/turn/validation';
import { SCENARIO } from '../src/game/scenario';
import { CLOSURES, makeModelOutput, makeRequest } from './helpers';

describe('player intention schema', () => {
  it.each(['understand', 'acknowledge', 'explain', 'repair'])(
    'accepts %s',
    (value) => expect(PlayerIntentSchema.safeParse(value).success).toBe(true)
  );
  it.each(['defend', 'pressure', 'unclear', '', null])('rejects %s', (value) => {
    expect(PlayerIntentSchema.safeParse(value).success).toBe(false);
  });
});

describe('perceived impact schema', () => {
  it.each([
    'understanding', 'acknowledgment', 'explanation', 'repair', 'defense',
    'minimization', 'pressure', 'avoidance', 'unclear',
  ])('accepts %s', (value) => {
    expect(PerceivedImpactSchema.safeParse(value).success).toBe(true);
  });
  it.each(['acknowledge', 'redirect', 'harmful', ''])('rejects %s', (value) => {
    expect(PerceivedImpactSchema.safeParse(value).success).toBe(false);
  });
});

describe('model output schema', () => {
  it('trims dialogue and impact reason', () => {
    const result = ModelOutputSchema.parse(
      makeModelOutput({ characterText: '  Hello.  ', impactReason: '  It landed.  ' })
    );
    expect(result.characterText).toBe('Hello.');
    expect(result.impactReason).toBe('It landed.');
  });
  it.each([-4, 4, 1.5])('rejects invalid engagement delta %s', (value) => {
    expect(ModelOutputSchema.safeParse(makeModelOutput({ engagementDelta: value })).success).toBe(false);
  });
  it.each([-4, 4, 1.5])('rejects invalid tension delta %s', (value) => {
    expect(ModelOutputSchema.safeParse(makeModelOutput({ tensionDelta: value })).success).toBe(false);
  });
  it('permits ordinary turns without closures', () => {
    expect(ModelOutputSchema.safeParse(makeModelOutput()).success).toBe(true);
  });
  it('accepts complete closures', () => {
    expect(ModelOutputSchema.safeParse(makeModelOutput({ finalClosures: CLOSURES })).success).toBe(true);
  });
  it.each(['', 'x'.repeat(181), '<b>unsafe</b>'])(
    'rejects unsafe impactReason',
    (impactReason) => expect(ModelOutputSchema.safeParse(makeModelOutput({ impactReason })).success).toBe(false)
  );
  it('rejects incomplete closures', () => {
    expect(FinalClosuresSchema.safeParse({ even: 'x', smoothed: 'y' }).success).toBe(false);
  });
});

describe('turn request schema', () => {
  it.each([0, 1, 8, 9])('accepts turn index %s', (turnIndex) => {
    expect(TurnRequestSchema.safeParse(makeRequest({ turnIndex })).success).toBe(true);
  });
  it.each([-1, 10, 1.2])('rejects turn index %s', (turnIndex) => {
    expect(TurnRequestSchema.safeParse(makeRequest({ turnIndex })).success).toBe(false);
  });
  it('rejects missing intention', () => {
    const request = { ...makeRequest() } as Record<string, unknown>;
    delete request.selectedIntention;
    expect(TurnRequestSchema.safeParse(request).success).toBe(false);
  });
  it('rejects an invalid scenario', () => {
    expect(TurnRequestSchema.safeParse(makeRequest({ scenarioId: 'other' })).success).toBe(false);
  });
  it('rejects oversized player input', () => {
    expect(TurnRequestSchema.safeParse(makeRequest({ playerText: 'x'.repeat(SCENARIO.maxPlayerTextLength + 1) })).success).toBe(false);
  });
  it('supports a complete 10-turn transcript', () => {
    const recentTranscript = Array.from({ length: 31 }, (_, index) => ({
      speaker: index % 2 ? ('player' as const) : ('character' as const),
      text: `Line ${index}`,
    }));
    expect(TurnRequestSchema.safeParse(makeRequest({ turnIndex: 9, recentTranscript: recentTranscript.slice(0, 20) })).success).toBe(true);
  });
  it('rejects a transcript beyond the full-run bound', () => {
    const recentTranscript = Array.from({ length: 32 }, () => ({ speaker: 'player' as const, text: 'x' }));
    expect(TurnRequestSchema.safeParse(makeRequest({ recentTranscript })).success).toBe(false);
  });
  it.each([-11, 11])('rejects out-of-range emotional state %s', (value) => {
    expect(TurnRequestSchema.safeParse(makeRequest({ state: { engagement: value, tension: 0 } })).success).toBe(false);
  });
});
