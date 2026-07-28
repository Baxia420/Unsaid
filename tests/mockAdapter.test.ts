import { describe, it, expect } from 'vitest';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { TurnRequest } from '../src/game/types';

const dummyRequest = (text: string): TurnRequest => ({
  scenarioId: 'demo',
  turnIndex: 0,
  playerText: text,
  state: { engagement: 0, tension: 0 },
  recentTranscript: [],
});

describe('MockModelAdapter', () => {
  it('valid mode returns output that passes ModelOutputSchema', async () => {
    const adapter = new MockModelAdapter('valid');
    const output = await adapter.generateTurn(dummyRequest('Hello'));
    const parsed = ModelOutputSchema.safeParse(output);
    expect(parsed.success).toBe(true);
  });

  it('malformed mode returns output that fails ModelOutputSchema', async () => {
    const adapter = new MockModelAdapter('malformed');
    const output = await adapter.generateTurn(dummyRequest('Hello'));
    const parsed = ModelOutputSchema.safeParse(output);
    expect(parsed.success).toBe(false);
  });

  it('error mode throws with expected inference error', async () => {
    const adapter = new MockModelAdapter('error');
    await expect(
      adapter.generateTurn(dummyRequest('Hello'))
    ).rejects.toThrow('Mock inference failure');
  });

  it('produces distinct responses for distinct player inputs', async () => {
    const adapter = new MockModelAdapter('valid');

    const sorry = await adapter.generateTurn(dummyRequest("I'm really sorry"));
    const why = await adapter.generateTurn(dummyRequest("Why did you do that?"));
    const defend = await adapter.generateTurn(dummyRequest("It's not my fault"));

    const sorryParsed = ModelOutputSchema.safeParse(sorry);
    const whyParsed = ModelOutputSchema.safeParse(why);
    const defendParsed = ModelOutputSchema.safeParse(defend);

    expect(sorryParsed.success).toBe(true);
    expect(whyParsed.success).toBe(true);
    expect(defendParsed.success).toBe(true);

    if (sorryParsed.success && whyParsed.success && defendParsed.success) {
      expect(sorryParsed.data.assessment.engagementDelta).toBe(2);
      expect(whyParsed.data.assessment.engagementDelta).toBe(-1);
      expect(defendParsed.data.assessment.engagementDelta).toBe(-2);

      expect(sorryParsed.data.assessment.tensionDelta).toBe(-1);
      expect(whyParsed.data.assessment.tensionDelta).toBe(2);
      expect(defendParsed.data.assessment.tensionDelta).toBe(1);

      expect(sorryParsed.data.characterText).not.toBe(whyParsed.data.characterText);
      expect(whyParsed.data.characterText).not.toBe(defendParsed.data.characterText);
    }
  });
});
