import { describe, it, expect } from 'vitest';
import { processTurn } from '../server/turn/service';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { TurnRequest } from '../src/game/types';
import { ModelAdapter } from '../server/adapters/ModelAdapter';

const baseRequest: TurnRequest = {
  scenarioId: 'demo',
  turnIndex: 0,
  playerText: 'I am sorry about what I said.',
  state: { engagement: 0, tension: 0 },
  recentTranscript: [],
};

describe('processTurn', () => {
  it('returns valid service output for valid adapter', async () => {
    const adapter = new MockModelAdapter('valid');
    const response = await processTurn(baseRequest, adapter);

    expect(response.characterText).toBe("I hear you. I just don't know what to say right now.");
    expect(response.assessment.intent).toBe('acknowledge');
    expect(response.assessment.engagementDelta).toBe(1);
    expect(response.assessment.tensionDelta).toBe(-1);
    expect(response.presentation.portraitState).toBeDefined();
  });

  it('returns fallback for malformed adapter output', async () => {
    const adapter = new MockModelAdapter('malformed');
    const response = await processTurn(baseRequest, adapter);

    expect(response.characterText).toBe("I'm not sure how to respond to that.");
    expect(response.assessment.intent).toBe('unclear');
    expect(response.assessment.engagementDelta).toBe(0);
    expect(response.assessment.tensionDelta).toBe(0);
  });

  it('returns fallback for thrown inference error', async () => {
    const adapter = new MockModelAdapter('error');
    const response = await processTurn(baseRequest, adapter);

    expect(response.characterText).toBe("I'm not sure how to respond to that.");
    expect(response.assessment.intent).toBe('unclear');
    expect(response.assessment.engagementDelta).toBe(0);
    expect(response.assessment.tensionDelta).toBe(0);
  });

  it('derives portrait state from code after a valid turn', async () => {
    const adapter = new MockModelAdapter('valid');
    const request: TurnRequest = {
      ...baseRequest,
      state: { engagement: -2, tension: 4 },
    };
    const response = await processTurn(request, adapter);

    // Starting from (-2, 4) with deltas (1, -1) => (-1, 3) => defensive
    expect(response.presentation.portraitState).toBe('defensive');
  });

  it('returns fallback for whitespace-only model characterText', async () => {
    const whitespaceAdapter: ModelAdapter = {
      async generateTurn() {
        return {
          characterText: '   ',
          assessment: {
            intent: 'acknowledge',
            engagementDelta: 0,
            tensionDelta: 0,
          },
        };
      },
    };

    const response = await processTurn(baseRequest, whitespaceAdapter);

    expect(response.characterText).toBe("I'm not sure how to respond to that.");
    expect(response.assessment.intent).toBe('unclear');
    expect(response.assessment.engagementDelta).toBe(0);
    expect(response.assessment.tensionDelta).toBe(0);
  });
});
