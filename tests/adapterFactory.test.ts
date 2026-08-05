import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createModelAdapter,
  createRecoveryAdapter,
  getRuntimeMode,
} from '../server/adapters/factory';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';

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
    expect(createRecoveryAdapter()).toBeInstanceOf(RecordedModelAdapter);
    expect(getRuntimeMode()).toBe('live');
  });

  it('selects explicit recorded demo mode', () => {
    process.env.UNSAID_AI_MODE = 'recorded';
    expect(createModelAdapter()).toBeInstanceOf(RecordedModelAdapter);
    expect(getRuntimeMode()).toBe('recorded');
  });

  it('falls back to recorded with warning when live mode has missing key', () => {
    process.env.UNSAID_AI_MODE = 'live';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(RecordedModelAdapter);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to recorded adapter')
    );
    expect(getRuntimeMode()).toBe('recorded');
  });

  it('falls back to recorded with warning when live mode has blank key', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = '   ';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createModelAdapter();
    expect(adapter).toBeInstanceOf(RecordedModelAdapter);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to recorded adapter')
    );
  });
});
