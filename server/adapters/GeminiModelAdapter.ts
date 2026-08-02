import { ModelAdapter } from './ModelAdapter';
import { TurnRequest } from '../../src/game/types';
import { buildLivePrompt } from '../turn/prompt';

interface GeminiGenerateContentRequest {
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  contents: Array<{
    role: 'user';
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType: 'application/json';
    responseSchema: {
      type: 'OBJECT';
      properties: {
        characterText: { type: 'STRING' };
        assessment: {
          type: 'OBJECT';
          properties: {
            intent: {
              type: 'STRING';
              enum: string[];
            };
            engagementDelta: { type: 'INTEGER' };
            tensionDelta: { type: 'INTEGER' };
          };
          required: string[];
        };
      };
      required: string[];
    };
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
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
      'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '15000', 10);
  }

  async generateTurn(request: TurnRequest): Promise<unknown> {
    const prompt = buildLivePrompt(request);
    const body: GeminiGenerateContentRequest = {
      systemInstruction: {
        parts: [{ text: prompt.system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt.user }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            characterText: { type: 'STRING' },
            assessment: {
              type: 'OBJECT',
              properties: {
                intent: {
                  type: 'STRING',
                  enum: [
                    'acknowledge',
                    'defend',
                    'minimize',
                    'redirect',
                    'repair',
                    'pressure',
                    'unclear',
                  ],
                },
                engagementDelta: { type: 'INTEGER' },
                tensionDelta: { type: 'INTEGER' },
              },
              required: ['intent', 'engagementDelta', 'tensionDelta'],
            },
          },
          required: ['characterText', 'assessment'],
        },
      },
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

  private async fetchOnce(body: GeminiGenerateContentRequest): Promise<unknown> {
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

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorJson = (await response.json()) as GeminiGenerateContentResponse;
          if (errorJson?.error) {
            const { code, status, message } = errorJson.error;
            const parts = [
              code ? `code: ${code}` : null,
              status ? `status: ${status}` : null,
              message ? `message: ${message}` : null,
            ].filter(Boolean);
            if (parts.length > 0) {
              errorDetail = ` — ${parts.join(', ')}`;
            }
          }
        } catch {
          // Ignore JSON parse error on non-ok body
        }

        let errorMessage = `Gemini returned HTTP ${response.status}${errorDetail}`;
        if (this.apiKey) {
          errorMessage = errorMessage.split(this.apiKey).join('[REDACTED]');
        }

        throw new GeminiHttpError(response.status, errorMessage);
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

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
