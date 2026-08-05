import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/index';

const originalMode = process.env.UNSAID_AI_MODE;
const originalKey = process.env.GEMINI_API_KEY;
const originalRecovery = process.env.UNSAID_LIVE_RECOVERY;

afterEach(() => {
  process.env.UNSAID_AI_MODE = originalMode;
  process.env.GEMINI_API_KEY = originalKey;
  process.env.UNSAID_LIVE_RECOVERY = originalRecovery;
  vi.restoreAllMocks();
});

describe('server startup diagnostics', () => {
  it('logs sanitized runtime info without the API key', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'secret-key-123';
    process.env.UNSAID_LIVE_RECOVERY = 'none';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = createApp();
    expect(app).toBeDefined();
    expect(log).toHaveBeenCalled();
    const output = log.mock.calls.flat().join(' ');
    expect(output).toContain('[UNSAID] AI runtime:');
    expect(output).toContain('mode=live');
    expect(output).toContain('keyConfigured=true');
    expect(output).toContain('recovery=none');
    expect(output).not.toContain('secret-key-123');
    expect(output).not.toContain('secret');
  });
  it('logs recovery=recorded when explicitly set', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'another-key';
    process.env.UNSAID_LIVE_RECOVERY = 'recorded';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = createApp();
    expect(app).toBeDefined();
    const output = log.mock.calls.flat().join(' ');
    expect(output).toContain('recovery=recorded');
    expect(output).not.toContain('another-key');
  });
  it('status endpoint reflects current recovery mode', async () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'key';
    process.env.UNSAID_LIVE_RECOVERY = 'recorded';
    const app = createApp();
    const request = (await import('supertest')).default(app);
    const response = await request.get('/api/status');
    expect(response.body.recoveryMode).toBe('recorded');
  });
});
