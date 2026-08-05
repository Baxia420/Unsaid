import { describe, expect, it } from 'vitest';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import type { TurnRequest } from '../src/game/types';

function request(playerText: string, turnIndex = 0): TurnRequest {
  return {
    scenarioId: 'say-it-again',
    turnIndex,
    playerText,
    state: { engagement: 0, tension: 0 },
    recentTranscript: [],
  };
}

describe('RecordedModelAdapter', () => {
  it('is deterministic and preserves repair-oriented agency', async () => {
    const adapter = new RecordedModelAdapter();
    const first = await adapter.generateTurn(request('I am sorry I let you down.'));
    const second = await adapter.generateTurn(request('I am sorry I let you down.'));
    expect(first).toEqual(second);
    expect(first).toMatchObject({ assessment: { intent: 'repair' } });
  });

  it('uses authored beat-aware neutral responses', async () => {
    const output = await new RecordedModelAdapter().generateTurn(request('Okay.', 2));
    expect(output).toMatchObject({
      characterText: "The part that hurt was waiting and realizing you weren't coming.",
      assessment: { intent: 'unclear' },
    });
  });
});
