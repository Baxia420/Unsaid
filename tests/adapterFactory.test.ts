import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { createModelAdapter, createRecoveryAdapter, getRuntimeMode } from '../server/adapters/factory';

const originalMode = process.env.UNSAID_AI_MODE;
const originalKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  process.env.UNSAID_AI_MODE = originalMode;
  process.env.GEMINI_API_KEY = originalKey;
  vi.restoreAllMocks();
});

describe('adapter factory', () => {
  it('creates mock adapter in mock mode', () => {
    process.env.UNSAID_AI_MODE = 'mock';
    expect(createModelAdapter()).toBeInstanceOf(MockModelAdapter);
  });
  it('creates recorded adapter in recorded mode', () => {
    process.env.UNSAID_AI_MODE = 'recorded';
    expect(createModelAdapter()).toBeInstanceOf(RecordedModelAdapter);
  });
  it('creates Gemini plus recorded recovery in configured live mode', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'test-secret';
    expect(createModelAdapter()).toBeInstanceOf(GeminiModelAdapter);
    expect(createRecoveryAdapter()).toBeInstanceOf(RecordedModelAdapter);
    expect(getRuntimeMode()).toBe('live');
  });
  it('falls back to recorded when live key is absent', () => {
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = '';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(createModelAdapter()).toBeInstanceOf(RecordedModelAdapter);
    expect(createRecoveryAdapter()).toBeUndefined();
    expect(getRuntimeMode()).toBe('recorded');
  });
  it('fails safely to mock for unsupported mode', () => {
    process.env.UNSAID_AI_MODE = 'unsupported';
    expect(createModelAdapter()).toBeInstanceOf(MockModelAdapter);
    expect(getRuntimeMode()).toBe('mock');
  });
  it('does not print credentials when selecting an adapter', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.UNSAID_AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'never-print-this';
    createModelAdapter();
    const output = [...log.mock.calls, ...warn.mock.calls].flat().join(' ');
    expect(output).not.toContain('never-print-this');
  });
});
