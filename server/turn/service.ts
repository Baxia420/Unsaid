import type { TurnRequest, TurnResponse } from '../../src/game/types';
import { applyTurn, derivePortraitState } from '../../src/game/state';
import { SCENARIO } from '../../src/game/scenario';
import type { ModelAdapter } from '../adapters/ModelAdapter';
import { ModelOutputSchema, type ValidatedModelOutput } from './schema';

async function generateValidatedOutput(
  request: TurnRequest,
  adapter: ModelAdapter
): Promise<ValidatedModelOutput | null> {
  try {
    const result = ModelOutputSchema.safeParse(await adapter.generateTurn(request));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
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

export async function processTurn(
  request: TurnRequest,
  primaryAdapter: ModelAdapter,
  recoveryAdapter?: ModelAdapter
): Promise<TurnResponse> {
  const primaryOutput = await generateValidatedOutput(request, primaryAdapter);
  if (primaryOutput) return makeResponse(request, primaryOutput);

  if (recoveryAdapter && recoveryAdapter !== primaryAdapter) {
    const recoveryOutput = await generateValidatedOutput(request, recoveryAdapter);
    if (recoveryOutput) return makeResponse(request, recoveryOutput);
  }

  return makeFallback(request);
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
