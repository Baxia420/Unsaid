import { create } from 'zustand';
import type {
  TranscriptEntry,
  PortraitState,
  TurnRequest,
  TurnAssessment,
  SceneMode,
  OutcomeDef,
} from './types';
import { applyTurn, derivePortraitState } from './state';
import { SCENARIO } from './scenario';
import { postTurn } from '../lib/turnClient';
import { canSubmitTurn, isRehearsalTurn } from './engine';
import { evaluateOutcome } from './outcome';

type Status = 'idle' | 'loading' | 'error';

export interface GameStore {
  engagement: number;
  tension: number;
  portraitState: PortraitState;
  transcript: TranscriptEntry[];
  turnIndex: number;
  input: string;
  pendingMessage: string | null;
  status: Status;
  error: string | null;
  assessments: TurnAssessment[];
  mode: SceneMode;
  outcome: OutcomeDef | null;
  imaginedResponse: string | null;
  setInput: (value: string) => void;
  submitTurn: () => Promise<void>;
  retryTurn: () => Promise<void>;
  restart: () => void;
}

function createInitialState(): Omit<
  GameStore,
  'setInput' | 'submitTurn' | 'retryTurn' | 'restart'
> {
  const starting = SCENARIO.startingState;
  return {
    engagement: starting.engagement,
    tension: starting.tension,
    portraitState: derivePortraitState(starting.engagement, starting.tension),
    transcript: [{ speaker: 'character', text: SCENARIO.openingLine }],
    turnIndex: 0,
    input: '',
    pendingMessage: null,
    status: 'idle',
    error: null,
    assessments: [],
    mode: 'reality',
    outcome: null,
    imaginedResponse: null,
  };
}

async function executeTurn(
  get: () => GameStore,
  set: (
    partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)
  ) => void,
  message: string
): Promise<void> {
  const state = get();

  const request: TurnRequest = {
    scenarioId: SCENARIO.id,
    turnIndex: state.turnIndex,
    playerText: message,
    state: {
      engagement: state.engagement,
      tension: state.tension,
    },
    recentTranscript: state.transcript,
  };

  try {
    const response = await postTurn(request);
    const latest = get();

    const newState = applyTurn(
      {
        engagement: latest.engagement,
        tension: latest.tension,
        portraitState: latest.portraitState,
      },
      response.assessment.engagementDelta,
      response.assessment.tensionDelta
    );

    const newAssessment: TurnAssessment = {
      intent: response.assessment.intent,
      engagementDelta: response.assessment.engagementDelta,
      tensionDelta: response.assessment.tensionDelta,
    };
    const newAssessments = [...latest.assessments, newAssessment];
    const newTurnIndex = latest.turnIndex + 1;
    const isComplete = newTurnIndex >= SCENARIO.totalTurns;

    const outcome: OutcomeDef | null = isComplete
      ? SCENARIO.outcomes[
          evaluateOutcome({
            intents: newAssessments.map((a) => a.intent),
            finalEngagement: newState.engagement,
            finalTension: newState.tension,
          })
        ]
      : null;

    const nextMode: SceneMode = isComplete
      ? 'outcome'
      : isRehearsalTurn(newTurnIndex)
        ? 'rehearsing'
        : 'reality';
    const nextImaginedResponse = nextMode === 'rehearsing'
      ? SCENARIO.imaginedResponses[newTurnIndex + 1] ?? null
      : null;

    set({
      engagement: newState.engagement,
      tension: newState.tension,
      portraitState: newState.portraitState,
      transcript: [
        ...latest.transcript,
        { speaker: 'player', text: message },
        { speaker: 'character', text: response.characterText },
      ],
      turnIndex: newTurnIndex,
      input: '',
      pendingMessage: null,
      status: 'idle',
      error: null,
      assessments: newAssessments,
      mode: nextMode,
      outcome,
      imaginedResponse: nextImaginedResponse,
    });
  } catch (err) {
    set({
      status: 'error',
      error:
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
    });
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  setInput: (value) => set({ input: value }),

  submitTurn: async () => {
    const state = get();
    const trimmed = state.input.trim();

    if (!trimmed || state.status === 'loading' || !canSubmitTurn(state.turnIndex, state.mode)) {
      return;
    }

    if (trimmed.length > SCENARIO.maxPlayerTextLength) {
      set({
        status: 'error',
        error: `Message must be ${SCENARIO.maxPlayerTextLength} characters or less.`,
      });
      return;
    }

    set({ status: 'loading', pendingMessage: trimmed, error: null });
    await executeTurn(get, set, trimmed);
  },

  retryTurn: async () => {
    const state = get();
    if (state.status !== 'error' || !state.pendingMessage || state.mode === 'outcome') return;

    set({ status: 'loading', error: null });
    await executeTurn(get, set, state.pendingMessage);
  },

  restart: () => {
    set(createInitialState());
  },
}));

export { createInitialState };
