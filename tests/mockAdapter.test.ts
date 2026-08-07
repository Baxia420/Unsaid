import { describe, expect, it, vi } from 'vitest';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { makeRequest } from './helpers';

describe('mock adapter', () => {
  it('is deterministic', async () => {
    const adapter = new MockModelAdapter();
    expect(await adapter.generateTurn(makeRequest())).toEqual(await adapter.generateTurn(makeRequest()));
  });
  it.each([
    ['understand', 'What hurt most?'], ['acknowledge', 'I am sorry I hurt you.'],
    ['explain', 'I panicked because I was overwhelmed.'], ['repair', 'What would I need to do differently?'],
  ] as const)('accepts intention %s', async (selectedIntention, playerText) => {
    const result = await new MockModelAdapter().generateTurn(makeRequest({ selectedIntention, playerText }));
    expect(ModelOutputSchema.safeParse(result).success).toBe(true);
  });
  it.each([
    ['What hurt most?', 'understanding'], ['I am sorry I hurt you.', 'acknowledgment'],
    ['It was just one event.', 'minimization'], ['Anyway, how has work been?', 'avoidance'],
    ["Please say we're okay so we can move on.", 'pressure'],
  ])('maps "%s" to %s', async (playerText, impact) => {
    const result = ModelOutputSchema.parse(await new MockModelAdapter().generateTurn(makeRequest({ playerText })));
    expect(result.perceivedImpact).toBe(impact);
    expect(result.impactReason.length).toBeGreaterThan(0);
  });
  it('returns closures only on turn 10', async () => {
    const adapter = new MockModelAdapter();
    expect(ModelOutputSchema.parse(await adapter.generateTurn(makeRequest())).finalClosures).toBeUndefined();
    expect(ModelOutputSchema.parse(await adapter.generateTurn(makeRequest({ turnIndex: 9 }))).finalClosures).toBeDefined();
  });
  it('comforts only the explicit guilt-plus-reassurance pattern needed for The Speech', async () => {
    const result = ModelOutputSchema.parse(await new MockModelAdapter().generateTurn(makeRequest({
      playerText: "I feel horrible. Please tell me I'm not a terrible person.",
      selectedIntention: 'repair',
    })));
    expect(result.characterText).toMatch(/not a terrible person/i);
    expect(result.perceivedImpact).toBe('pressure');
  });
  it('supports a complete 10-turn run', async () => {
    const adapter = new MockModelAdapter();
    for (let turnIndex = 0; turnIndex < 10; turnIndex += 1) {
      expect(ModelOutputSchema.safeParse(await adapter.generateTurn(makeRequest({ turnIndex }))).success).toBe(true);
    }
  });
  it('does not use fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await new MockModelAdapter().generateTurn(makeRequest());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it('supports malformed and thrown-error modes', async () => {
    expect(ModelOutputSchema.safeParse(await new MockModelAdapter('malformed').generateTurn(makeRequest())).success).toBe(false);
    await expect(new MockModelAdapter('error').generateTurn(makeRequest())).rejects.toThrow('Mock inference failure');
  });
});
