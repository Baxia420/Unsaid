import { describe, expect, it, vi } from 'vitest';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { makeRequest } from './helpers';

describe('recorded adapter', () => {
  it('is deterministic across instances', async () => {
    expect(await new RecordedModelAdapter().generateTurn(makeRequest())).toEqual(await new RecordedModelAdapter().generateTurn(makeRequest()));
  });
  it('returns the new response contract', async () => {
    expect(ModelOutputSchema.safeParse(await new RecordedModelAdapter().generateTurn(makeRequest())).success).toBe(true);
  });
  it.each([0, 1, 7, 13])('supports ordinary turn %s without closures', async (turnIndex) => {
    const output = ModelOutputSchema.parse(await new RecordedModelAdapter().generateTurn(makeRequest({ turnIndex })));
    expect(output.finalClosures).toBeUndefined();
  });
  it('returns closures on turn 10', async () => {
    const output = ModelOutputSchema.parse(await new RecordedModelAdapter().generateTurn(makeRequest({ turnIndex: 9 })));
    expect(output.finalClosures).toBeDefined();
  });
  it('supports two independent complete runs without state leakage', async () => {
    async function run() {
      const adapter = new RecordedModelAdapter();
      return Promise.all(Array.from({ length: 10 }, (_, turnIndex) => adapter.generateTurn(makeRequest({ turnIndex }))));
    }
    expect(await run()).toEqual(await run());
  });
  it('performs no network requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await new RecordedModelAdapter().generateTurn(makeRequest());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
