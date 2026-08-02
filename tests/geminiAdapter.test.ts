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
    process.env.GEMINI_BASE_URL = 'https://test.example.com/v1beta';
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

  function mockNativeSuccessResponse(contentObj: unknown) {
    return mockFetchResponse(200, {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(contentObj) }],
          },
        },
      ],
    });
  }

  it('uses configured base URL, model, x-goog-api-key auth, native body shape, and structured output config without temperature', async () => {
    mockNativeSuccessResponse({
      characterText: 'OK',
      assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 },
    });

    await adapter.generateTurn(baseRequest);

    const call = vi.mocked(fetch).mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    const body = JSON.parse(init.body as string);

    expect(url).toBe('https://test.example.com/v1beta/models/test-model:generateContent');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-api-key-789',
    });
    expect(body.systemInstruction?.parts?.[0]?.text).toBeDefined();
    expect(body.contents?.[0]?.role).toBe('user');
    expect(body.contents?.[0]?.parts?.[0]?.text).toContain('I am really sorry');
    expect(body.generationConfig).toMatchObject({
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    });
    expect(body.generationConfig.temperature).toBeUndefined();
    expect(body.generationConfig.responseSchema).toBeDefined();
  });

  it('uses default model gemini-3.6-flash when GEMINI_MODEL is not set', async () => {
    delete process.env.GEMINI_MODEL;
    const defaultAdapter = new GeminiModelAdapter();
    mockNativeSuccessResponse({
      characterText: 'OK',
      assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 },
    });

    await defaultAdapter.generateTurn(baseRequest);

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toBe('https://test.example.com/v1beta/models/gemini-3.6-flash:generateContent');
  });

  it('handles model ID that already includes models/ prefix correctly', async () => {
    process.env.GEMINI_MODEL = 'models/test-model-prefixed';
    const customAdapter = new GeminiModelAdapter();
    mockNativeSuccessResponse({
      characterText: 'OK',
      assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 },
    });

    await customAdapter.generateTurn(baseRequest);

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toBe('https://test.example.com/v1beta/models/test-model-prefixed:generateContent');
  });

  it('does not place the API key in the JSON request body', async () => {
    mockNativeSuccessResponse({
      characterText: 'OK',
      assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 },
    });

    await adapter.generateTurn(baseRequest);

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const bodyStr = JSON.stringify(JSON.parse(init.body as string));
    expect(bodyStr).not.toContain('test-api-key-789');
  });

  it('returns parsed JSON on success from native candidate response extraction', async () => {
    const expected = { characterText: 'Thanks.', assessment: { intent: 'acknowledge', engagementDelta: 1, tensionDelta: 0 } };
    mockNativeSuccessResponse(expected);

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual(expected);
  });

  it('throws sanitized error on invalid JSON inside candidate text', async () => {
    mockFetchResponse(200, {
      candidates: [{ content: { parts: [{ text: 'not-valid-json' }] } }],
    });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('invalid JSON');
  });

  it('throws sanitized error on empty candidate or empty text', async () => {
    mockFetchResponse(200, {
      candidates: [{ content: { parts: [{ text: '' }] } }],
    });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('empty content');
  });

  it('throws sanitized error on missing candidates envelope', async () => {
    mockFetchResponse(200, {});

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('empty content');
  });

  it('returns schema-invalid content to caller without rejecting inside adapter', async () => {
    const raw = { characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1.5, tensionDelta: 0 } };
    mockNativeSuccessResponse(raw);

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual(raw);
  });

  it('sanitizes HTTP 400 error output with provider error details', async () => {
    mockFetchResponse(400, {
      error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Invalid model parameter' },
    });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow(
      'Gemini returned HTTP 400 — code: 400, status: INVALID_ARGUMENT, message: Invalid model parameter'
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry HTTP 401 and redacts API key if present in error message', async () => {
    mockFetchResponse(401, {
      error: { code: 401, status: 'UNAUTHENTICATED', message: 'Key test-api-key-789 is invalid' },
    });

    try {
      await adapter.generateTurn(baseRequest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain('[REDACTED]');
      expect(msg).not.toContain('test-api-key-789');
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry HTTP 403 or HTTP 404', async () => {
    mockFetchResponse(404, {
      error: { code: 404, status: 'NOT_FOUND', message: 'Model not found' },
    });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('HTTP 404');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries HTTP 429 once then succeeds', async () => {
    mockFetchResponse(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Rate limited' } });
    mockNativeSuccessResponse({
      characterText: 'OK',
      assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 },
    });

    const result = await adapter.generateTurn(baseRequest);
    expect(result).toEqual({ characterText: 'OK', assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries HTTP 500 once then falls back to throwing', async () => {
    mockFetchResponse(500, { error: { code: 500, status: 'INTERNAL', message: 'Internal error' } });
    mockFetchResponse(500, { error: { code: 500, status: 'INTERNAL', message: 'Internal error again' } });

    await expect(adapter.generateTurn(baseRequest)).rejects.toThrow('HTTP 500');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries network failure once then succeeds', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('fetch failed'));
    mockNativeSuccessResponse({
      characterText: 'OK',
      assessment: { intent: 'repair', engagementDelta: 1, tensionDelta: -1 },
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
