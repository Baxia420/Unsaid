import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { TurnRequest } from '../src/game/types';

describe('GeminiModelAdapter', () => {
  const originalEnv = process.env;
  let adapter: GeminiModelAdapter;

  const baseRequest: TurnRequest = {
    scenarioId: 'say-it-again',
    turnIndex: 0,
    playerText: 'I am really sorry about what happened.',
    state: { engagement: 0, tension: 0 },
    recentTranscript: [],
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-api-key-789';
    process.env.GEMINI_BASE_URL = 'https://test.example.com/v1';
    process.env.GEMINI_MODEL = 'test-model';
    process.env.GEMINI_TIMEOUT_MS = '5000';
    adapter = new GeminiModelAdapter();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockFetchResponse(status: number, body: unknown) {
    return vi.mocked(fetch).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  }

  it('uses configured base URL, model, Bearer auth, structured output, and non-streaming', async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } }) } }],
    });

    await adapter.generateTurn(baseRequest);

    const call = vi.mocked(fetch).mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    const body = JSON.parse(init.body as string);

    expect(url).toBe('https://test.example.com/v1/chat/completions');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-api-key-789',
    });
    expect(body.model).toBe('test-model');
    expect(body.stream).toBe(false);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(1024);
  });

  it('does not place the API key in the JSON body', async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } }) } }],
    });

    await adapter.generateTurn(baseRequest);

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('test-api-key-789');
  });

  it('returns parsed JSON on success', async () => {
    const expected = { characterText: 'Thanks.', assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: 0 } };
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify(expected) } }],
    });

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual(expected);
  });

  it('throws sanitized error on invalid JSON', async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: 'not-json' } }],
    });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('invalid JSON');
  });

  it('throws sanitized error on empty content', async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: '' } }],
    });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('empty content');
  });

  it('throws sanitized error on malformed envelope (no choices)', async () => {
    mockFetchResponse(200, {});

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('empty content');
  });

  it('returns schema-invalid content to the caller without rejecting inside adapter', async () => {
    const raw = { characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1.5, tensionDelta: 0 } };
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify(raw) } }],
    });

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual(raw);
  });

  it('does not retry HTTP 400', async () => {
    mockFetchResponse(400, { error: 'Bad request' });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('HTTP 400');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry HTTP 401', async () => {
    mockFetchResponse(401, { error: 'Unauthorized' });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('HTTP 401');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry HTTP 403', async () => {
    mockFetchResponse(403, { error: 'Forbidden' });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('HTTP 403');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries HTTP 429 once then succeeds', async () => {
    mockFetchResponse(429, { error: 'Rate limited' });
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } }) } }],
    });

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries HTTP 500 once then falls back to throwing', async () => {
    mockFetchResponse(500, { error: 'Server error' });
    mockFetchResponse(500, { error: 'Server error again' });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('HTTP 500');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries network failure once then succeeds', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('fetch failed'));
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } }) } }],
    });

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries timeout once then falls back to throwing', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('fetch failed'));
    vi.mocked(fetch).mockRejectedValueOnce(new Error('fetch failed'));

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('fetch failed');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('error messages do not contain the API key', async () => {
    mockFetchResponse(401, { error: 'Unauthorized' });

    try {
      await adapter.generateTurn(baseRequest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toContain('test-api-key-789');
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('mock mode makes zero external fetch calls', async () => {
    const { createModelAdapter } = await import('../server/adapters/factory');
    process.env.UNSAID_AI_MODE = 'mock';
    delete process.env.GEMINI_API_KEY;

    const mockAdapter = createModelAdapter();
    const result = await mockAdapter.generateTurn(baseRequest);
    expect(result).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
