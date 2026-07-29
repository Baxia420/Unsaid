import { describe, it, expect } from 'vitest';
import { processTurn } from '../server/turn/service';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { TurnRequest } from '../src/game/types';
import { ModelAdapter } from '../server/adapters/ModelAdapter';

const baseRequest = (text: string): TurnRequest => ({
  scenarioId: 'say-it-again',
  turnIndex: 0,
  playerText: text,
  state: { engagement: 0, tension: 0 },
  recentTranscript: [],
});

describe('processTurn', () => {
  it('returns valid service output for valid adapter', async () => {
    const adapter = new MockModelAdapter('valid');
    const response = await processTurn(baseRequest('I understand how you feel'), adapter);

    expect(response.characterText).toBe("I hear you. I just don't know what to say right now.");
    expect(response.assessment.intent).toBe('acknowledge');
    expect(response.assessment.engagementDelta).toBe(1);
    expect(response.assessment.tensionDelta).toBe(-1);
    expect(response.presentation.portraitState).toBeDefined();
  });

  it('returns fallback for malformed adapter output', async () => {
    const adapter = new MockModelAdapter('malformed');
    const response = await processTurn(baseRequest('Hello'), adapter);

    expect(response.characterText).toBe("I'm not sure how to respond to that.");
    expect(response.assessment.intent).toBe('unclear');
    expect(response.assessment.engagementDelta).toBe(0);
    expect(response.assessment.tensionDelta).toBe(0);
  });

  it('returns fallback for thrown inference error', async () => {
    const adapter = new MockModelAdapter('error');
    const response = await processTurn(baseRequest('Hello'), adapter);

    expect(response.characterText).toBe("I'm not sure how to respond to that.");
    expect(response.assessment.intent).toBe('unclear');
    expect(response.assessment.engagementDelta).toBe(0);
    expect(response.assessment.tensionDelta).toBe(0);
  });

  it('derives portrait state from code after a valid turn', async () => {
    const adapter = new MockModelAdapter('valid');
    const request: TurnRequest = {
      ...baseRequest('Why did this happen?'),
      state: { engagement: -2, tension: 4 },
    };
    const response = await processTurn(request, adapter);

    // Starting from (-2, 4) with pressure deltas (-1, 2) => (-3, 6) => defensive
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

    const response = await processTurn(baseRequest('Hello'), whitespaceAdapter);

    expect(response.characterText).toBe("I'm not sure how to respond to that.");
    expect(response.assessment.intent).toBe('unclear');
    expect(response.assessment.engagementDelta).toBe(0);
    expect(response.assessment.tensionDelta).toBe(0);
  });

  it('changes portrait state during a short conversation', async () => {
    const adapter = new MockModelAdapter('valid');

    // Turn 1: "why" => pressure (-1, +2) => (-1, 2) => distant
    let request = baseRequest('Why did you leave?');
    let response = await processTurn(request, adapter);
    expect(response.assessment.engagementDelta).toBe(-1);
    expect(response.assessment.tensionDelta).toBe(2);
    expect(response.presentation.portraitState).toBe('distant');

    // Turn 2: "defend" => defend (-2, +1) => (-3, 3) => defensive
    request = { ...baseRequest('I have to defend myself'), turnIndex: 1, state: { engagement: -1, tension: 2 }, recentTranscript: [] };
    response = await processTurn(request, adapter);
    expect(response.assessment.engagementDelta).toBe(-2);
    expect(response.assessment.tensionDelta).toBe(1);
    expect(response.presentation.portraitState).toBe('defensive');

    // Turn 3: "sorry" => repair (+2, -1) => (-1, 2) => distant
    request = { ...baseRequest("I'm really sorry"), turnIndex: 2, state: { engagement: -3, tension: 3 }, recentTranscript: [] };
    response = await processTurn(request, adapter);
    expect(response.assessment.engagementDelta).toBe(2);
    expect(response.assessment.tensionDelta).toBe(-1);
    expect(response.presentation.portraitState).toBe('distant');

    // Turn 4: "understand" => acknowledge (+1, -1) => (0, 1) => connected
    request = { ...baseRequest('I understand now'), turnIndex: 3, state: { engagement: -1, tension: 2 }, recentTranscript: [] };
    response = await processTurn(request, adapter);
    expect(response.assessment.engagementDelta).toBe(1);
    expect(response.assessment.tensionDelta).toBe(-1);
    expect(response.presentation.portraitState).toBe('connected');
  });
});
