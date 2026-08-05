import type { TurnRequest } from '../../src/game/types';
import type { ModelAdapter } from './ModelAdapter';
import { buildLivePrompt } from '../turn/prompt';

const IMPACT_VALUES = [
  'understanding',
  'acknowledgment',
  'explanation',
  'repair',
  'defense',
  'minimization',
  'pressure',
  'avoidance',
  'unclear',
];

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

class GeminiHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GeminiHttpError';
  }
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('network')
  );
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function redactSecret(message: string, secret: string): string {
  return secret ? message.split(secret).join('[REDACTED]') : message;
}

function createResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      characterText: { type: 'STRING' },
      perceivedImpact: { type: 'STRING', enum: IMPACT_VALUES },
      impactReason: { type: 'STRING' },
      engagementDelta: { type: 'INTEGER' },
      tensionDelta: { type: 'INTEGER' },
      finalClosures: {
        type: 'OBJECT',
        properties: {
          even: { type: 'STRING' },
          smoothed: { type: 'STRING' },
          the_speech: { type: 'STRING' },
        },
        required: ['even', 'smoothed', 'the_speech'],
      },
    },
    required: [
      'characterText',
      'perceivedImpact',
      'impactReason',
      'engagementDelta',
      'tensionDelta',
    ],
  };
}

export class GeminiModelAdapter implements ModelAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl =
      process.env.GEMINI_BASE_URL ??
      'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = process.env.GEMINI_API_KEY ?? '';
    this.model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
    this.timeoutMs = Number.parseInt(
      process.env.GEMINI_TIMEOUT_MS ?? '15000',
      10
    );
  }

  async generateTurn(request: TurnRequest): Promise<unknown> {
    const prompt = buildLivePrompt(request);
    const requestBody = {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        maxOutputTokens: 1400,
        responseMimeType: 'application/json',
        responseSchema: createResponseSchema(),
      },
    };

    let lastError: Error = new Error('Gemini request failed');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.fetchOnce(requestBody);
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error('Gemini request failed');
        const retryable =
          isTransientError(error) ||
          (error instanceof GeminiHttpError && isTransientStatus(error.status));
        if (attempt === 0 && retryable) continue;
        break;
      }
    }

    throw new Error(redactSecret(lastError.message, this.apiKey));
  }

  private async fetchOnce(body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const modelPath = this.model.startsWith('models/')
      ? this.model
      : `models/${this.model}`;
    const url = `${cleanBaseUrl}/${modelPath}:generateContent`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = '';
        try {
          const payload = (await response.json()) as GeminiGenerateContentResponse;
          const parts = [
            payload.error?.code ? `code: ${payload.error.code}` : null,
            payload.error?.status ? `status: ${payload.error.status}` : null,
            payload.error?.message ? `message: ${payload.error.message}` : null,
          ].filter(Boolean);
          if (parts.length) detail = ` — ${parts.join(', ')}`;
        } catch {
          // A non-JSON provider error still becomes a sanitized HTTP error.
        }
        throw new GeminiHttpError(
          response.status,
          redactSecret(
            `Gemini returned HTTP ${response.status}${detail}`,
            this.apiKey
          )
        );
      }

      const payload = (await response.json()) as GeminiGenerateContentResponse;
      const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content?.trim()) {
        throw new Error('Gemini response contained empty content');
      }
      return JSON.parse(content) as unknown;
    } catch (error) {
      if (error instanceof GeminiHttpError) throw error;
      if (error instanceof SyntaxError) {
        throw new Error('Gemini response contained invalid JSON');
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gemini request timed out');
      }
      if (error instanceof Error) {
        throw new Error(redactSecret(error.message, this.apiKey));
      }
      throw new Error('Gemini request failed due to network or provider error');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
