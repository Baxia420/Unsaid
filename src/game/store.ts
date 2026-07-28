import { create } from 'zustand';
import { TranscriptEntry, PortraitState, TurnRequest } from './types';
import { applyTurn, derivePortraitState } from './state';
import { SCENARIO } from './scenario';
import { postTurn } from '../lib/turnClient';

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
  setInput: (value: string) => void;
  submitTurn: () => Promise<void>;
  retryTurn: () => Promise<void>;
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

    set({
      engagement: newState.engagement,
      tension: newState.tension,
      portraitState: newState.portraitState,
      transcript: [
        ...latest.transcript,
        { speaker: 'player', text: message },
        { speaker: 'character', text: response.characterText },
      ],
      turnIndex: latest.turnIndex + 1,
      input: '',
      pendingMessage: null,
      status: 'idle',
      error: null,
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
  engagement: SCENARIO.startingState.engagement,
  tension: SCENARIO.startingState.tension,
  portraitState: derivePortraitState(
    SCENARIO.startingState.engagement,
    SCENARIO.startingState.tension
  ),
  transcript: [],
  turnIndex: 0,
  input: '',
  pendingMessage: null,
  status: 'idle',
  error: null,

  setInput: (value) => set({ input: value }),

  submitTurn: async () => {
    const state = get();
    const trimmed = state.input.trim();

    if (!trimmed || state.status === 'loading') return;

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
    if (state.status !== 'error' || !state.pendingMessage) return;

    set({ status: 'loading', error: null });
    await executeTurn(get, set, state.pendingMessage);
  },
}));
