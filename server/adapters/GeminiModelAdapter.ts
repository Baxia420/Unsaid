import { ModelAdapter } from './ModelAdapter';
import { TurnRequest } from '../../src/game/types';
import { buildLivePrompt } from '../turn/prompt';

interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  max_tokens: number;
  stream: false;
  response_format: { type: 'json_object' };
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

class GeminiHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'GeminiHttpError';
  }
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message.includes('timeout')) return true;
    if (error.message.includes('fetch failed')) return true;
    if (error.message.includes('network')) return true;
  }
  return false;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class GeminiModelAdapter implements ModelAdapter {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl =
      process.env.GEMINI_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta/openai';
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '15000', 10);
  }

  async generateTurn(request: TurnRequest): Promise<unknown> {
    const prompt = buildLivePrompt(request);
    const body: ChatCompletionRequest = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      stream: false,
      response_format: { type: 'json_object' },
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.fetchOnce(body);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (
          attempt === 0 &&
          (isTransientError(error) ||
            (error instanceof GeminiHttpError && isTransientStatus(error.status)))
        ) {
          continue;
        }
        break;
      }
    }

    throw lastError || new Error('Gemini request failed');
  }

  private async fetchOnce(body: ChatCompletionRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new GeminiHttpError(
          response.status,
          `Gemini returned HTTP ${response.status}`
        );
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content || content.trim() === '') {
        throw new Error('Gemini response contained empty content');
      }

      const parsed = JSON.parse(content) as unknown;
      return parsed;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof GeminiHttpError) throw error;
      if (error instanceof SyntaxError) {
        throw new Error('Gemini response contained invalid JSON');
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gemini request timed out');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Gemini request failed due to network or provider error');
    }
  }
}
