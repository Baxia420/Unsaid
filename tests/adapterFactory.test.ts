import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createModelAdapter } from '../server/adapters/factory';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';

describe('createModelAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.UNSAID_AI_MODE;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('defaults to mock when UNSAID_AI_MODE is absent', () => {
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(MockModelAdapter);
  });

  it('defaults to mock when UNSAID_AI_MODE is not live', () => {
    process.env.UNSAID_AI_MODE = 'mock';
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(MockModelAdapter);
  });

  it('selects Gemini when UNSAID_AI_MODE is live and GEMINI_API_KEY is present', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'test-key-123';
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(GeminiModelAdapter);
  });

  it('falls back to mock with warning when live mode has missing key', () => {
    process.env.UNSAID_AI_MODE = 'live';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(MockModelAdapter);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to mock adapter')
    );
  });

  it('falls back to mock with warning when live mode has blank key', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = '   ';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(MockModelAdapter);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to mock adapter')
    );
  });
});
