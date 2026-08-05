import { MockModelAdapter } from './MockModelAdapter';
import { GeminiModelAdapter } from './GeminiModelAdapter';
import { RecordedModelAdapter } from './RecordedModelAdapter';
import type { ModelAdapter } from './ModelAdapter';

export function createModelAdapter(): ModelAdapter {
  const mode = process.env.UNSAID_AI_MODE;
  if (mode === 'recorded') {
    return new RecordedModelAdapter();
  }
  if (mode === 'live') {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      console.warn(
        '[UNSAID] live mode selected but GEMINI_API_KEY is missing or blank. Falling back to recorded adapter.'
      );
      return new RecordedModelAdapter();
    }
    return new GeminiModelAdapter();
  }
  return new MockModelAdapter();
}

export function createRecoveryAdapter(): ModelAdapter | undefined {
  if (process.env.UNSAID_AI_MODE !== 'live') return undefined;
  if (getLiveRecovery() !== 'recorded') return undefined;
  return new RecordedModelAdapter();
}

export function getLiveRecovery(): 'none' | 'recorded' {
  const recovery = process.env.UNSAID_LIVE_RECOVERY?.trim().toLowerCase();
  if (recovery === 'recorded') return 'recorded';
  return 'none';
}

export function getRuntimeMode(): 'live' | 'recorded' | 'mock' {
  if (process.env.UNSAID_AI_MODE === 'recorded') return 'recorded';
  if (process.env.UNSAID_AI_MODE === 'live' && process.env.GEMINI_API_KEY?.trim()) return 'live';
  if (process.env.UNSAID_AI_MODE === 'live') return 'recorded';
  return 'mock';
}
