import { MockModelAdapter } from './MockModelAdapter.ts';
import { GeminiModelAdapter } from './GeminiModelAdapter.ts';
import { RecordedModelAdapter } from './RecordedModelAdapter.ts';
import type { ModelAdapter } from './ModelAdapter.ts';

export function createModelAdapter(): ModelAdapter {
  const mode = process.env.UNSAID_AI_MODE;
  if (mode === 'recorded') {
    return new RecordedModelAdapter();
  }
  if (mode === 'live') {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      console.warn(
        '[UNSAID] live mode selected but GEMINI_API_KEY is missing or blank. Live requests will fail closed.'
      );
      return {
        async generateTurn(): Promise<never> {
          throw new Error('Live AI is not configured.');
        },
      };
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
  if (process.env.UNSAID_AI_MODE === 'live') return 'live';
  return 'mock';
}
