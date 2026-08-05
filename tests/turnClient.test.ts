import { afterEach, describe, expect, it, vi } from 'vitest';
import { postTurn, TurnClientError } from '../src/lib/turnClient';
import { makeRequest, makeTurnResponse } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('turn client', () => {
  it('sends intention, exact message, state, and transcript in one request', async () => {
    const request = makeRequest({ playerText: 'Exact committed text', selectedIntention: 'repair' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makeTurnResponse()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await postTurn(request);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ playerText: 'Exact committed text', selectedIntention: 'repair', state: request.state, recentTranscript: request.recentTranscript });
  });
  it('returns a valid server response', async () => {
    const expected = makeTurnResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(expected), { status: 200 })));
    await expect(postTurn(makeRequest())).resolves.toEqual(expected);
  });
  it.each([400, 500, 503])('converts HTTP %s to a player-safe error', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret body', { status })));
    await expect(postTurn(makeRequest())).rejects.toThrow(`Server error: ${status}`);
  });
  it('handles malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{broken', { status: 200 })));
    await expect(postTurn(makeRequest())).rejects.toThrow('Invalid response from server');
  });
  it('handles network failures without leaking details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret network detail')));
    const promise = postTurn(makeRequest());
    await expect(promise).rejects.toBeInstanceOf(TurnClientError);
    await expect(promise).rejects.not.toThrow('secret network detail');
  });
  it('never creates a second impact-assessment request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makeTurnResponse()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await postTurn(makeRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
