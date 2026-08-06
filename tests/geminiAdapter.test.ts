import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { makeModelOutput, makeRequest } from './helpers';

const ORIGINAL_ENV = { ...process.env };

function providerResponse(content: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(
    JSON.stringify(
      status === 200
        ? { candidates: [{ content: { parts: [{ text: typeof content === 'string' ? content : JSON.stringify(content) }] } }] }
        : { error: content }
    ),
    { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } }
  );
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: '50' };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Gemini adapter request construction', () => {
  it('defaults to Gemini 3.5 Flash-Lite', async () => {
    delete process.env.GEMINI_MODEL;
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest());
    expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-3.5-flash-lite:generateContent');
  });
  it('reads model from environment', async () => {
    process.env.GEMINI_MODEL = 'custom-model';
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest());
    expect(fetchMock.mock.calls[0][0]).toContain('/models/custom-model:generateContent');
  });
  it('accepts a models/ prefix without duplication', async () => {
    process.env.GEMINI_MODEL = 'models/prefixed-model';
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest());
    expect(fetchMock.mock.calls[0][0]).toContain('/models/prefixed-model:generateContent');
    expect(fetchMock.mock.calls[0][0]).not.toContain('/models/models/');
  });
  it('uses the native Gemini endpoint and API-key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com/v1beta');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
  });
  it('sends structured JSON output with all impacts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const config = body.generationConfig;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseSchema.properties.perceivedImpact.enum).toEqual([
      'understanding','acknowledgment','explanation','repair','defense','minimization','pressure','avoidance','unclear',
    ]);
  });
  it('omits finalClosures from ordinary-turn schemas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest({ turnIndex: 0 }));
    const schema = JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.responseSchema;
    expect(schema.properties.finalClosures).toBeUndefined();
    expect(schema.required).not.toContain('finalClosures');
  });
  it('includes finalClosures in turn-10 schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest({ turnIndex: 9 }));
    const schema = JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.responseSchema;
    expect(schema.properties.finalClosures).toBeDefined();
    expect(schema.required).toContain('finalClosures');
  });
});

describe('Gemini adapter safety and retries', () => {
  it('parses valid provider JSON and returns unknown data', async () => {
    const output = { ...makeModelOutput(), extraProviderField: true };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(providerResponse(output)));
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).resolves.toEqual(output);
  });
  it('rejects invalid JSON without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse('{invalid'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).rejects.toThrow('invalid JSON');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('rejects empty provider content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(providerResponse('   ')));
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).rejects.toThrow('empty content');
  });
  it('retries a transient network error once', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValueOnce(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('retries HTTP 429 once with bounded delay', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(providerResponse({ message: 'temporary' }, 429)).mockResolvedValueOnce(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    const start = Date.now();
    await new GeminiModelAdapter().generateTurn(makeRequest());
    const elapsed = Date.now() - start;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeGreaterThanOrEqual(3000);
  }, 10000);
  it('retries HTTP 429 and respects Retry-After header', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(providerResponse({ message: 'rate limit' }, 429, { 'Retry-After': '2' })).mockResolvedValueOnce(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    const start = Date.now();
    await new GeminiModelAdapter().generateTurn(makeRequest());
    const elapsed = Date.now() - start;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeGreaterThanOrEqual(1500);
    expect(elapsed).toBeLessThan(6000);
  }, 10000);
  it.each([500, 503])('retries HTTP %s once', async (status) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(providerResponse({ message: 'temporary' }, status)).mockResolvedValueOnce(providerResponse(makeModelOutput()));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiModelAdapter().generateTurn(makeRequest());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 404])('does not retry HTTP %s', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse({ message: 'ordinary failure' }, status));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).rejects.toThrow(`HTTP ${status}`);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('never retries more than once', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('sanitizes the API key from provider errors', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(providerResponse({ message: 'failure test-key leaked' }, 400))
    );
    vi.stubGlobal('fetch', fetchMock);
    try { await new GeminiModelAdapter().generateTurn(makeRequest()); } catch (error) {
      expect((error as Error).message).not.toContain('test-key');
      expect((error as Error).message).toContain('[REDACTED]');
    }
  });
  it('aborts timed-out requests and reports a safe timeout', async () => {
    process.env.GEMINI_TIMEOUT_MS = '5';
    const fetchMock = vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiModelAdapter().generateTurn(makeRequest())).rejects.toThrow('timed out');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('preserves GeminiHttpError with status, retryAfter, and causeCode after retry loop', async () => {
    const errorDetail = { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(providerResponse(errorDetail, 429, { 'Retry-After': '0' }))
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await new GeminiModelAdapter().generateTurn(makeRequest());
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const { GeminiHttpError } = await import('../server/adapters/GeminiModelAdapter');
      expect(err).toBeInstanceOf(GeminiHttpError);
      const httpErr = err as InstanceType<typeof GeminiHttpError>;
      expect(httpErr.status).toBe(429);
      expect(httpErr.retryAfter).toBe(0);
      expect(httpErr.causeCode).toBe('RESOURCE_EXHAUSTED');
      expect(httpErr.message).not.toContain('test-key');
    }
  }, 15000);
});
