import type { TurnRequest, TurnResponse } from '../../src/game/types';
import { applyTurn, derivePortraitState } from '../../src/game/state';
import { SCENARIO } from '../../src/game/scenario';
import type { ModelAdapter } from '../adapters/ModelAdapter';
import { ModelOutputSchema, type ValidatedModelOutput } from './schema';

function hasStatus(error: unknown): error is { status: number } {
  return error instanceof Error && 'status' in error && typeof (error as Record<string, unknown>).status === 'number';
}

function categorizeAdapterError(error: unknown): { category: string; retryable: boolean } {
  if (hasStatus(error)) {
    const status = error.status;
    if (status === 400) return { category: 'HTTP_400', retryable: false };
    if (status === 401) return { category: 'HTTP_401', retryable: false };
    if (status === 403) return { category: 'HTTP_403', retryable: false };
    if (status === 404) return { category: 'HTTP_404', retryable: false };
    if (status === 429) return { category: 'HTTP_429', retryable: true };
    if (status >= 500) return { category: 'HTTP_5XX', retryable: true };
    return { category: `HTTP_${status}`, retryable: false };
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (error.name === 'AbortError' || msg.includes('timed out') || msg.includes('timeout')) return { category: 'TIMEOUT', retryable: true };
    if (msg.includes('fetch failed') || msg.includes('network')) return { category: 'NETWORK_ERROR', retryable: true };
    if (msg.includes('empty content')) return { category: 'EMPTY_CONTENT', retryable: true };
    if (msg.includes('invalid json')) return { category: 'INVALID_JSON', retryable: false };
  }
  return { category: 'UNKNOWN_PROVIDER_ERROR', retryable: false };
}

async function generateWithDiagnostics(
  request: TurnRequest,
  adapter: ModelAdapter,
  _source: TurnExecutionResult['source']
): Promise<{ output: ValidatedModelOutput | null; error?: { category: string; retryable: boolean }; latencyMs: number }> {
  const start = Date.now();
  try {
    const raw = await adapter.generateTurn(request);
    const parsed = ModelOutputSchema.safeParse(raw);
    const latencyMs = Date.now() - start;
    if (parsed.success) return { output: parsed.data, latencyMs };
    return { output: null, error: { category: 'SCHEMA_INVALID', retryable: false }, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const { category, retryable } = categorizeAdapterError(error);
    return { output: null, error: { category, retryable }, latencyMs };
  }
}

export interface TurnExecutionResult {
  response: TurnResponse;
  source: 'gemini' | 'recorded' | 'mock' | 'recorded-recovery' | 'deterministic-fallback';
  recoveryUsed: boolean;
  failureCategory?: string;
  retryable?: boolean;
  latencyMs?: number;
}

export async function processTurnDetailed(
  request: TurnRequest,
  primaryAdapter: ModelAdapter,
  recoveryAdapter?: ModelAdapter
): Promise<TurnExecutionResult> {
  const primary = await generateWithDiagnostics(request, primaryAdapter, 'gemini');

  if (primary.output) {
    return {
      response: makeResponse(request, primary.output),
      source: 'gemini',
      recoveryUsed: false,
      latencyMs: primary.latencyMs,
    };
  }

  if (recoveryAdapter && recoveryAdapter !== primaryAdapter) {
    const recovery = await generateWithDiagnostics(request, recoveryAdapter, 'recorded-recovery');
    if (recovery.output) {
      return {
        response: makeResponse(request, recovery.output),
        source: 'recorded-recovery',
        recoveryUsed: true,
        failureCategory: primary.error?.category,
      };
    }
  }

  return {
    response: makeFallback(request),
    source: 'deterministic-fallback',
    recoveryUsed: false,
    failureCategory: primary.error?.category,
    retryable: primary.error?.retryable,
  };
}

export async function processTurn(
  request: TurnRequest,
  primaryAdapter: ModelAdapter,
  recoveryAdapter?: ModelAdapter
): Promise<TurnResponse> {
  const result = await processTurnDetailed(request, primaryAdapter, recoveryAdapter);
  return result.response;
}

function makeResponse(
  request: TurnRequest,
  output: ValidatedModelOutput
): TurnResponse {
  const currentState = {
    ...request.state,
    portraitState: derivePortraitState(
      request.state.engagement,
      request.state.tension
    ),
  };
  const nextState = applyTurn(
    currentState,
    output.engagementDelta,
    output.tensionDelta
  );
  const isFinalTurn = request.turnIndex === SCENARIO.totalTurns - 1;

  return {
    characterText: output.characterText,
    assessment: {
      perceivedImpact: output.perceivedImpact,
      impactReason: output.impactReason,
      engagementDelta: output.engagementDelta,
      tensionDelta: output.tensionDelta,
    },
    presentation: { portraitState: nextState.portraitState },
    ...(isFinalTurn
      ? { finalClosures: output.finalClosures ?? SCENARIO.fallbackClosures }
      : {}),
  };
}

export function makeFallback(request: TurnRequest): TurnResponse {
  const isFinalTurn = request.turnIndex === SCENARIO.totalTurns - 1;
  return {
    characterText: SCENARIO.fallbackCharacterLine,
    assessment: {
      perceivedImpact: 'unclear',
      impactReason: 'Your meaning did not land clearly enough for an answer yet.',
      engagementDelta: 0,
      tensionDelta: 0,
    },
    presentation: {
      portraitState: derivePortraitState(
        request.state.engagement,
        request.state.tension
      ),
    },
    ...(isFinalTurn ? { finalClosures: SCENARIO.fallbackClosures } : {}),
  };
}
