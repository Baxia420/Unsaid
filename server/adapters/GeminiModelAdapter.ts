import type { TurnRequest } from '../../src/game/types.js';
import type { ModelAdapter } from './ModelAdapter.js';
import { buildLivePrompt } from '../turn/prompt.js';
import { SCENARIO } from '../../src/game/scenario.js';

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

export class GeminiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
    public readonly causeCode?: string
  ) {
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

function createResponseSchema(isFinalTurn: boolean) {
  const properties: Record<string, unknown> = {
    characterText: { type: 'STRING' },
    perceivedImpact: { type: 'STRING', enum: IMPACT_VALUES },
    impactReason: { type: 'STRING' },
    engagementDelta: { type: 'INTEGER' },
    tensionDelta: { type: 'INTEGER' },
  };

  if (isFinalTurn) {
    properties.finalClosures = {
      type: 'OBJECT',
      properties: {
        even: { type: 'STRING' },
        smoothed: { type: 'STRING' },
        the_speech: { type: 'STRING' },
      },
      required: ['even', 'smoothed', 'the_speech'],
    };
  }

  const required = [
    'characterText',
    'perceivedImpact',
    'impactReason',
    'engagementDelta',
    'tensionDelta',
  ];
  if (isFinalTurn) required.push('finalClosures');

  return { type: 'OBJECT', properties, required };
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
        responseSchema: createResponseSchema(request.turnIndex === SCENARIO.totalTurns - 1),
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
        if (attempt === 0 && retryable) {
          if (error instanceof GeminiHttpError && error.status === 429) {
            const delayMs = error.retryAfter !== undefined
              ? Math.min(error.retryAfter * 1000, 10000)
              : 4000;
            await new Promise<void>((r) => setTimeout(r, delayMs));
          }
          continue;
        }
        break;
      }
    }

    if (lastError instanceof Error) {
      lastError.message = redactSecret(lastError.message, this.apiKey);
    }
    throw lastError;
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
        let retryAfter: number | undefined;
        const retryAfterHeader = response.headers.get('retry-after');
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!Number.isNaN(parsed)) retryAfter = parsed;
        }

        let detail = '';
        let causeCode: string | undefined;
        try {
          const payload = (await response.json()) as GeminiGenerateContentResponse;
          if (payload.error?.status) causeCode = payload.error.status;
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
          ),
          retryAfter,
          causeCode
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
        const redactedMsg = redactSecret(error.message, this.apiKey);
        const causeCode = (error as { cause?: { code?: string } }).cause?.code;
        const err = new Error(redactedMsg);
        if (causeCode && typeof causeCode === 'string') {
          (err as { causeCode?: string }).causeCode = causeCode;
        }
        throw err;
      }
      throw new Error('Gemini request failed due to network or provider error');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
