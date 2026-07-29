import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore, GameStore, createInitialState } from '../src/game/store';
import { postTurn } from '../src/lib/turnClient';
import { TurnResponse } from '../src/game/types';

vi.mock('../src/lib/turnClient', () => ({
  postTurn: vi.fn(),
  TurnClientError: class TurnClientError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TurnClientError';
    }
  },
}));

function resetStore() {
  useGameStore.setState(createInitialState() as Partial<GameStore>);
}

describe('GameStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('rejects empty input on submit', async () => {
    useGameStore.setState({ input: '   ' });
    await useGameStore.getState().submitTurn();
    expect(useGameStore.getState().status).toBe('idle');
  });

  it('rejects whitespace-only input on submit', async () => {
    useGameStore.setState({ input: '\t\n ' });
    await useGameStore.getState().submitTurn();
    expect(useGameStore.getState().status).toBe('idle');
  });

  it('enforces configured player-text limit', async () => {
    useGameStore.setState({ input: 'a'.repeat(501) });
    await useGameStore.getState().submitTurn();
    const state = useGameStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toContain('500');
  });

  it('successful submission updates transcript and state', async () => {
    const mockResponse: TurnResponse = {
      characterText: 'I understand.',
      assessment: { intent: 'acknowledge', engagementDelta: 2, tensionDelta: 1 },
      presentation: { portraitState: 'connected' },
    };
    vi.mocked(postTurn).mockResolvedValue(mockResponse);

    useGameStore.setState({ input: 'I am sorry.' });
    await useGameStore.getState().submitTurn();

    const state = useGameStore.getState();
    expect(state.transcript).toHaveLength(3);
    expect(state.transcript[0]).toEqual({ speaker: 'character', text: 'You said you wanted to talk.' });
    expect(state.transcript[1]).toEqual({ speaker: 'player', text: 'I am sorry.' });
    expect(state.transcript[2]).toEqual({ speaker: 'character', text: 'I understand.' });
    expect(state.engagement).toBe(2);
    expect(state.tension).toBe(1);
    expect(state.turnIndex).toBe(1);
    expect(state.input).toBe('');
    expect(state.status).toBe('idle');
  });

  it('applies state deltas through code-owned applyTurn logic', async () => {
    const mockResponse: TurnResponse = {
      characterText: 'Reaction.',
      assessment: { intent: 'pressure', engagementDelta: 5, tensionDelta: -5 },
      presentation: { portraitState: 'connected' },
    };
    vi.mocked(postTurn).mockResolvedValue(mockResponse);

    useGameStore.setState({ input: 'Push it.' });
    await useGameStore.getState().submitTurn();

    const state = useGameStore.getState();
    // Deltas should be clamped to [-3, 3] by deltaBounds, then to [-10, 10] by state bounds
    expect(state.engagement).toBe(3);
    expect(state.tension).toBe(-3);
    // portraitState derived by code, not model
    expect(state.portraitState).toBe('connected');
  });

  it('prevents duplicate submissions while loading', async () => {
    let resolveTurn: (value: TurnResponse) => void;
    const turnPromise = new Promise<TurnResponse>((resolve) => {
      resolveTurn = resolve;
    });
    vi.mocked(postTurn).mockReturnValue(turnPromise);

    useGameStore.setState({ input: 'First' });
    const first = useGameStore.getState().submitTurn();

    // Attempt second submission while first is in flight
    await useGameStore.getState().submitTurn();

    expect(useGameStore.getState().status).toBe('loading');
    expect(postTurn).toHaveBeenCalledTimes(1);

    resolveTurn!({
      characterText: 'Reply.',
      assessment: { intent: 'acknowledge', engagementDelta: 0, tensionDelta: 0 },
      presentation: { portraitState: 'connected' },
    });
    await first;
  });

  it('network failure preserves the message and exposes retry', async () => {
    vi.mocked(postTurn).mockRejectedValue(new Error('Network error'));

    useGameStore.setState({ input: 'Important message.' });
    await useGameStore.getState().submitTurn();

    const state = useGameStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network error');
    expect(state.pendingMessage).toBe('Important message.');
    expect(state.transcript).toHaveLength(1);
    expect(state.transcript[0]).toEqual({ speaker: 'character', text: 'You said you wanted to talk.' });
    expect(state.turnIndex).toBe(0);
  });

  it('retry succeeds without duplicate transcript entries', async () => {
    vi.mocked(postTurn)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        characterText: 'Recovered reply.',
        assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: 0 },
        presentation: { portraitState: 'connected' },
      });

    useGameStore.setState({ input: 'Retry me.' });
    await useGameStore.getState().submitTurn();
    expect(useGameStore.getState().status).toBe('error');

    await useGameStore.getState().retryTurn();
    const state = useGameStore.getState();
    expect(state.status).toBe('idle');
    expect(state.transcript).toHaveLength(3);
    expect(state.transcript[0]).toEqual({ speaker: 'character', text: 'You said you wanted to talk.' });
    expect(state.transcript[1]).toEqual({ speaker: 'player', text: 'Retry me.' });
    expect(state.transcript[2]).toEqual({ speaker: 'character', text: 'Recovered reply.' });
    expect(state.turnIndex).toBe(1);
  });

  it('deterministic 3-turn conversation with correct turnIndex and bounded state', async () => {
    const responses: TurnResponse[] = [
      {
        characterText: 'Turn 1 reply.',
        assessment: { intent: 'acknowledge', engagementDelta: 2, tensionDelta: 2 },
        presentation: { portraitState: 'connected' },
      },
      {
        characterText: 'Turn 2 reply.',
        assessment: { intent: 'defend', engagementDelta: -3, tensionDelta: 3 },
        presentation: { portraitState: 'defensive' },
      },
      {
        characterText: 'Turn 3 reply.',
        assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -2 },
        presentation: { portraitState: 'connected' },
      },
    ];

    let callIndex = 0;
    vi.mocked(postTurn).mockImplementation(async () => {
      return responses[callIndex++];
    });

    const messages = ['Hello', 'Wait', 'Please'];
    for (const msg of messages) {
      useGameStore.setState({ input: msg });
      await useGameStore.getState().submitTurn();
    }

    const state = useGameStore.getState();
    expect(state.turnIndex).toBe(3);
    expect(state.transcript).toHaveLength(7);

    // State progression: (0,0) -> +2,+2 => (2,2)
    //                    (2,2) -> -3,+3 => (-1,5)
    //                    (-1,5) -> +1,-2 => (0,3)
    expect(state.engagement).toBe(0);
    expect(state.tension).toBe(3);
    expect(state.engagement).toBeGreaterThanOrEqual(-10);
    expect(state.engagement).toBeLessThanOrEqual(10);
    expect(state.tension).toBeGreaterThanOrEqual(-10);
    expect(state.tension).toBeLessThanOrEqual(10);
    expect(state.portraitState).toBe('hurt_exposed');
  });

  it('completes after exactly five turns and evaluates outcome', async () => {
    const responses: TurnResponse[] = [
      { characterText: 'T1', assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T2', assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T3', assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T4', assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T5', assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
    ];

    let callIndex = 0;
    vi.mocked(postTurn).mockImplementation(async () => responses[callIndex++]);

    for (let i = 0; i < 5; i++) {
      useGameStore.setState({ input: `Turn ${i + 1}` });
      await useGameStore.getState().submitTurn();
    }

    const state = useGameStore.getState();
    expect(state.turnIndex).toBe(5);
    expect(state.phase).toBe('outcome');
    expect(state.outcome).not.toBeNull();
    expect(state.outcome!.id).toBe('even');
  });

  it('blocks a sixth submission', async () => {
    const responses: TurnResponse[] = [
      { characterText: 'T1', assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T2', assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T3', assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T4', assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
      { characterText: 'T5', assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: -1 }, presentation: { portraitState: 'connected' } },
    ];

    let callIndex = 0;
    vi.mocked(postTurn).mockImplementation(async () => responses[callIndex++]);

    for (let i = 0; i < 5; i++) {
      useGameStore.setState({ input: `Turn ${i + 1}` });
      await useGameStore.getState().submitTurn();
    }

    expect(postTurn).toHaveBeenCalledTimes(5);

    useGameStore.setState({ input: 'Sixth' });
    await useGameStore.getState().submitTurn();

    expect(postTurn).toHaveBeenCalledTimes(5);
    expect(useGameStore.getState().turnIndex).toBe(5);
    expect(useGameStore.getState().phase).toBe('outcome');
  });

  it('restart restores initial state including opening line', async () => {
    const mockResponse: TurnResponse = {
      characterText: 'Reply.',
      assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: -1 },
      presentation: { portraitState: 'connected' },
    };
    vi.mocked(postTurn).mockResolvedValue(mockResponse);

    useGameStore.setState({ input: 'Hello' });
    await useGameStore.getState().submitTurn();

    const before = useGameStore.getState();
    expect(before.turnIndex).toBe(1);
    expect(before.transcript).toHaveLength(3);

    useGameStore.getState().restart();

    const after = useGameStore.getState();
    const initial = createInitialState();
    expect(after.turnIndex).toBe(0);
    expect(after.transcript).toEqual(initial.transcript);
    expect(after.engagement).toBe(initial.engagement);
    expect(after.tension).toBe(initial.tension);
    expect(after.phase).toBe('playing');
    expect(after.outcome).toBeNull();
    expect(after.assessments).toEqual([]);
  });
});
