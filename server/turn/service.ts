import type { TurnRequest, TurnResponse } from '../../src/game/types';
import { applyTurn, derivePortraitState } from '../../src/game/state';
import { SCENARIO } from '../../src/game/scenario';
import type { ModelAdapter } from '../adapters/ModelAdapter';
import { ModelOutputSchema, type ValidatedModelOutput } from './schema';
import { advanceNarrativeState, createTurnDirective, type TurnDirective } from './directive';

export interface CategorizedError {
  category: string;
  retryable: boolean;
  status?: number;
  retryAfter?: number;
  causeCode?: string;
}

function hasStatus(error: unknown): error is { status: number } {
  return error instanceof Error && 'status' in error && typeof (error as Record<string, unknown>).status === 'number';
}

export function categorizeAdapterError(error: unknown): CategorizedError {
  let status: number | undefined;
  let retryAfter: number | undefined;
  let causeCode: string | undefined;

  if (hasStatus(error)) {
    status = error.status;
    if ('retryAfter' in error && typeof (error as { retryAfter?: unknown }).retryAfter === 'number') {
      retryAfter = (error as { retryAfter: number }).retryAfter;
    }
    if ('causeCode' in error && typeof (error as { causeCode?: unknown }).causeCode === 'string') {
      causeCode = (error as { causeCode: string }).causeCode;
    }
  } else if (error && typeof error === 'object') {
    if ('causeCode' in error && typeof (error as { causeCode?: unknown }).causeCode === 'string') {
      causeCode = (error as { causeCode: string }).causeCode;
    }
  }

  if (status !== undefined) {
    if (status === 400) return { category: 'HTTP_400', retryable: false, status, retryAfter, causeCode };
    if (status === 401) return { category: 'HTTP_401', retryable: false, status, retryAfter, causeCode };
    if (status === 403) return { category: 'HTTP_403', retryable: false, status, retryAfter, causeCode };
    if (status === 404) return { category: 'HTTP_404', retryable: false, status, retryAfter, causeCode };
    if (status === 429) return { category: 'HTTP_429', retryable: true, status, retryAfter, causeCode };
    if (status >= 500) return { category: 'HTTP_5XX', retryable: true, status, retryAfter, causeCode };
    return { category: `HTTP_${status}`, retryable: false, status, retryAfter, causeCode };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const errWithCause = error as { cause?: { code?: string } };
    if (!causeCode && errWithCause.cause?.code && typeof errWithCause.cause.code === 'string') {
      causeCode = errWithCause.cause.code;
    }

    if (error.name === 'AbortError' || msg.includes('timed out') || msg.includes('timeout')) {
      return { category: 'TIMEOUT', retryable: true, causeCode };
    }
    if (msg.includes('fetch failed') || msg.includes('network')) {
      return { category: 'NETWORK_ERROR', retryable: true, causeCode };
    }
    if (msg.includes('empty content')) {
      return { category: 'EMPTY_CONTENT', retryable: true };
    }
    if (msg.includes('invalid json')) {
      return { category: 'INVALID_JSON', retryable: false };
    }
  }

  return { category: 'UNKNOWN_PROVIDER_ERROR', retryable: false };
}

async function generateWithDiagnostics(
  request: TurnRequest,
  adapter: ModelAdapter,
  _source: TurnExecutionResult['source']
): Promise<{ output: ValidatedModelOutput | null; error?: CategorizedError; latencyMs: number }> {
  const start = Date.now();
  try {
    const raw = await adapter.generateTurn(request);
    const parsed = ModelOutputSchema.safeParse(raw);
    const latencyMs = Date.now() - start;
    if (parsed.success) return { output: parsed.data, latencyMs };
    return { output: null, error: { category: 'SCHEMA_INVALID', retryable: false }, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const cat = categorizeAdapterError(error);
    return { output: null, error: cat, latencyMs };
  }
}

export interface TurnExecutionResult {
  response: TurnResponse;
  source: 'gemini' | 'recorded' | 'mock' | 'recorded-recovery' | 'deterministic-fallback';
  recoveryUsed: boolean;
  failureCategory?: string;
  retryable?: boolean;
  latencyMs?: number;
  httpStatus?: number;
  retryAfter?: number;
  causeCode?: string;
}

export async function processTurnDetailed(
  request: TurnRequest,
  primaryAdapter: ModelAdapter,
  recoveryAdapter?: ModelAdapter
): Promise<TurnExecutionResult> {
  const directive = createTurnDirective(request);
  const primary = await generateWithDiagnostics(request, primaryAdapter, 'gemini');

  if (primary.output) {
    return {
      response: makeResponse(request, primary.output, directive),
      source: 'gemini',
      recoveryUsed: false,
      latencyMs: primary.latencyMs,
    };
  }

  if (recoveryAdapter && recoveryAdapter !== primaryAdapter) {
    const recovery = await generateWithDiagnostics(request, recoveryAdapter, 'recorded-recovery');
    if (recovery.output) {
      return {
        response: makeResponse(request, recovery.output, directive),
        source: 'recorded-recovery',
        recoveryUsed: true,
        failureCategory: primary.error?.category,
        httpStatus: primary.error?.status,
        retryAfter: primary.error?.retryAfter,
        causeCode: primary.error?.causeCode,
      };
    }
  }

  return {
    response: makeFallback(request),
    source: 'deterministic-fallback',
    recoveryUsed: false,
    failureCategory: primary.error?.category,
    retryable: primary.error?.retryable,
    httpStatus: primary.error?.status,
    retryAfter: primary.error?.retryAfter,
    causeCode: primary.error?.causeCode,
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
  output: ValidatedModelOutput,
  directive: TurnDirective = createTurnDirective(request)
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
    narrative: {
      state: advanceNarrativeState(request, directive),
      meta: {
        sceneMove: directive.primaryMove,
        memoryId: directive.offeredMemory?.id ?? null,
        activeBelief: advanceNarrativeState(request, directive).activeBelief,
      },
    },
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
