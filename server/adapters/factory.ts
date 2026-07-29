import { MockModelAdapter } from './MockModelAdapter';
import { GeminiModelAdapter } from './GeminiModelAdapter';
import type { ModelAdapter } from './ModelAdapter';

export function createModelAdapter(): ModelAdapter {
  const mode = process.env.UNSAID_AI_MODE;
  if (mode === 'live') {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      console.warn(
        '[UNSAID] live mode selected but GEMINI_API_KEY is missing or blank. Falling back to mock adapter.'
      );
      return new MockModelAdapter();
    }
    return new GeminiModelAdapter();
  }
  return new MockModelAdapter();
}
