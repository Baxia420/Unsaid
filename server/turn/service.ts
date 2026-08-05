import { TurnRequest, TurnResponse } from '../../src/game/types';
import { applyTurn, derivePortraitState } from '../../src/game/state';
import { SCENARIO } from '../../src/game/scenario';
import { ModelAdapter } from '../adapters/ModelAdapter';
import { ModelOutputSchema } from './schema';

export async function processTurn(
  request: TurnRequest,
  adapter: ModelAdapter,
  recoveryAdapter?: ModelAdapter
): Promise<TurnResponse> {
  try {
    const raw = await adapter.generateTurn(request);
    const parsed = ModelOutputSchema.safeParse(raw);

    if (!parsed.success) {
      return recoveryAdapter
        ? processTurn(request, recoveryAdapter)
        : makeFallback(request);
    }

    const output = parsed.data;
    const newState = applyTurn(
      {
        engagement: request.state.engagement,
        tension: request.state.tension,
        portraitState: derivePortraitState(
          request.state.engagement,
          request.state.tension
        ),
      },
      output.assessment.engagementDelta,
      output.assessment.tensionDelta
    );

    return {
      characterText: output.characterText,
      assessment: {
        intent: output.assessment.intent,
        engagementDelta: output.assessment.engagementDelta,
        tensionDelta: output.assessment.tensionDelta,
      },
      presentation: {
        portraitState: newState.portraitState,
      },
    };
  } catch {
    return recoveryAdapter
      ? processTurn(request, recoveryAdapter)
      : makeFallback(request);
  }
}

function makeFallback(request: TurnRequest): TurnResponse {
  const portraitState = derivePortraitState(
    request.state.engagement,
    request.state.tension
  );

  return {
    characterText: SCENARIO.fallbackCharacterLine,
    assessment: {
      intent: 'unclear',
      engagementDelta: 0,
      tensionDelta: 0,
    },
    presentation: {
      portraitState,
    },
  };
}
