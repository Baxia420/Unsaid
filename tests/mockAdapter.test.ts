import { describe, it, expect } from 'vitest';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { TurnRequest } from '../src/game/types';

const dummyRequest: TurnRequest = {
  scenarioId: 'demo',
  turnIndex: 0,
  playerText: 'Hello',
  state: { engagement: 0, tension: 0 },
  recentTranscript: [],
};

describe('MockModelAdapter', () => {
  it('valid mode returns output that passes ModelOutputSchema', async () => {
    const adapter = new MockModelAdapter('valid');
    const output = await adapter.generateTurn(dummyRequest);
    const parsed = ModelOutputSchema.safeParse(output);
    expect(parsed.success).toBe(true);
  });

  it('malformed mode returns output that fails ModelOutputSchema', async () => {
    const adapter = new MockModelAdapter('malformed');
    const output = await adapter.generateTurn(dummyRequest);
    const parsed = ModelOutputSchema.safeParse(output);
    expect(parsed.success).toBe(false);
  });

  it('error mode throws with expected inference error', async () => {
    const adapter = new MockModelAdapter('error');
    await expect(
      adapter.generateTurn(dummyRequest)
    ).rejects.toThrow('Mock inference failure');
  });
});
