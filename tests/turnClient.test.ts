import { describe, it, expect, vi } from 'vitest';
import { postTurn, TurnClientError } from '../src/lib/turnClient';
import { TurnRequest } from '../src/game/types';

const validRequest: TurnRequest = {
  scenarioId: 'demo',
  turnIndex: 0,
  playerText: 'Hello',
  state: { engagement: 0, tension: 0 },
  recentTranscript: [],
};

const validResponse = {
  characterText: 'Hi there.',
  assessment: {
    intent: 'acknowledge',
    engagementDelta: 1,
    tensionDelta: -1,
  },
  presentation: {
    portraitState: 'connected',
  },
};

describe('postTurn', () => {
  it('calls POST /api/turn with JSON headers and body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(validResponse), { status: 200 })
    );

    await postTurn(validRequest);

    expect(fetchSpy).toHaveBeenCalledWith('/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });

    fetchSpy.mockRestore();
  });

  it('returns parsed TurnResponse on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(validResponse), { status: 200 })
    );

    const result = await postTurn(validRequest);
    expect(result).toEqual(validResponse);
  });

  it('throws TurnClientError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('net::ERR_FAILED'));

    await expect(postTurn(validRequest)).rejects.toThrow(TurnClientError);
    await expect(postTurn(validRequest)).rejects.toThrow('Network error');
  });

  it('throws TurnClientError on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
    );

    await expect(postTurn(validRequest)).rejects.toThrow(TurnClientError);
    await expect(postTurn(validRequest)).rejects.toThrow('Server error: 400');
  });

  it('throws TurnClientError on invalid JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not json', { status: 200 })
    );

    await expect(postTurn(validRequest)).rejects.toThrow(TurnClientError);
    await expect(postTurn(validRequest)).rejects.toThrow('Invalid response');
  });
});
