import { create } from 'zustand';
import type {
  AppMode,
  FinalClosures,
  OutcomeDef,
  PlayerIntent,
  PortraitState,
  TranscriptEntry,
  TurnAssessment,
  TurnRequest,
} from './types';
import { SCENARIO } from './scenario';
import { applyTurn, derivePortraitState } from './state';
import { classifyAlignment, evaluateOutcome } from './outcome';
import { postTurn } from '../lib/turnClient';

type Status = 'idle' | 'loading' | 'error';

interface GameData {
  mode: AppMode;
  status: Status;
  error: string | null;
  input: string;
  selectedIntention: PlayerIntent | null;
  engagement: number;
  tension: number;
  portraitState: PortraitState;
  transcript: TranscriptEntry[];
  turnIndex: number;
  assessments: TurnAssessment[];
  outcome: OutcomeDef | null;
  closingMessage: string | null;
  pendingMessage: string | null;
  pendingIntention: PlayerIntent | null;
  runId: number;
  activeRequestId: number | null;
  prologuePart: number;
}

export interface GameStore extends GameData {
  start: () => void;
  continueFromPrologue: () => void;
  nextProloguePart: () => void;
  prevProloguePart: () => void;
  skipPrologue: () => void;
  selectIntention: (intent: PlayerIntent) => void;
  setInput: (input: string) => void;
  submitTurn: () => Promise<void>;
  retryTurn: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  continueToOutcome: () => void;
  restart: () => void;
  returnToTitle: () => void;
}

let nextRequestId = 1;

export function createInitialState(runId = 0): GameData {
  const { engagement, tension } = SCENARIO.startingState;
  return {
    mode: 'title',
    status: 'idle',
    error: null,
    input: '',
    selectedIntention: null,
    engagement,
    tension,
    portraitState: derivePortraitState(engagement, tension),
    transcript: [],
    turnIndex: 0,
    assessments: [],
    outcome: null,
    closingMessage: null,
    pendingMessage: null,
    pendingIntention: null,
    runId,
    activeRequestId: null,
    prologuePart: 0,
  };
}

function isCurrentRequest(
  state: GameStore,
  runId: number,
  requestId: number
): boolean {
  return state.runId === runId && state.activeRequestId === requestId;
}

async function executeTurn(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  message: string,
  intention: PlayerIntent
): Promise<void> {
  const initialState = get();
  const runId = initialState.runId;
  const requestId = nextRequestId++;
  const request: TurnRequest = {
    scenarioId: SCENARIO.id,
    turnIndex: initialState.turnIndex,
    playerText: message,
    selectedIntention: intention,
    state: {
      engagement: initialState.engagement,
      tension: initialState.tension,
    },
    recentTranscript: initialState.transcript,
  };

  set({ activeRequestId: requestId });

  try {
    const response = await postTurn(request);
    const current = get();
    if (!isCurrentRequest(current, runId, requestId)) return;

    const nextState = applyTurn(
      {
        engagement: current.engagement,
        tension: current.tension,
        portraitState: current.portraitState,
      },
      response.assessment.engagementDelta,
      response.assessment.tensionDelta
    );
    const assessment: TurnAssessment = {
      ...response.assessment,
      selectedIntent: intention,
      alignment: classifyAlignment(
        intention,
        response.assessment.perceivedImpact
      ),
    };
    const assessments = [...current.assessments, assessment];
    const turnIndex = current.turnIndex + 1;
    const transcript: TranscriptEntry[] = [
      ...current.transcript,
      { speaker: 'player', text: message },
      { speaker: 'character', text: response.characterText },
    ];
    const commonUpdate: Partial<GameStore> = {
      engagement: nextState.engagement,
      tension: nextState.tension,
      portraitState: nextState.portraitState,
      transcript,
      assessments,
      turnIndex,
      input: '',
      selectedIntention: null,
      pendingMessage: null,
      pendingIntention: null,
      status: 'idle',
      error: null,
      activeRequestId: null,
    };

    if (turnIndex === SCENARIO.totalTurns) {
      const outcomeId = evaluateOutcome({
        assessments,
        finalEngagement: nextState.engagement,
        finalTension: nextState.tension,
      });
      const closures: FinalClosures =
        response.finalClosures ?? SCENARIO.fallbackClosures;
      set({
        ...commonUpdate,
        outcome: SCENARIO.outcomes[outcomeId],
        closingMessage: closures[outcomeId],
        mode: current.mode === 'paused' ? 'paused' : 'closing',
      });
      return;
    }

    set(commonUpdate);
  } catch (error) {
    const current = get();
    if (!isCurrentRequest(current, runId, requestId)) return;
    set({
      status: 'error',
      activeRequestId: null,
      error:
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
    });
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  start: () => {
    const runId = get().runId + 1;
    set({ ...createInitialState(runId), mode: 'prologue', prologuePart: 0 });
  },

  continueFromPrologue: () => {
    if (get().mode !== 'prologue') return;
    set({
      mode: 'playing',
      transcript: [{ speaker: 'character', text: SCENARIO.openingLine }],
    });
  },

  nextProloguePart: () => {
    if (get().mode !== 'prologue') return;
    const nextPart = get().prologuePart + 1;
    if (nextPart >= SCENARIO.prologueParts.length) {
      get().continueFromPrologue();
    } else {
      set({ prologuePart: nextPart });
    }
  },

  prevProloguePart: () => {
    if (get().mode !== 'prologue') return;
    const prevPart = get().prologuePart - 1;
    if (prevPart < 0) {
      set({ mode: 'title', prologuePart: 0 });
    } else {
      set({ prologuePart: prevPart });
    }
  },

  skipPrologue: () => {
    if (get().mode !== 'prologue') return;
    get().continueFromPrologue();
  },

  selectIntention: (selectedIntention) => set({ selectedIntention }),
  setInput: (input) => set({ input }),

  submitTurn: async () => {
    const state = get();
    const message = state.input.trim();
    const intention = state.selectedIntention;
    if (
      !message ||
      !intention ||
      state.status === 'loading' ||
      state.mode !== 'playing' ||
      state.turnIndex >= SCENARIO.totalTurns
    ) {
      return;
    }
    if (message.length > SCENARIO.maxPlayerTextLength) {
      set({
        status: 'error',
        error: `Message must be ${SCENARIO.maxPlayerTextLength} characters or less.`,
      });
      return;
    }

    set({
      status: 'loading',
      error: null,
      pendingMessage: message,
      pendingIntention: intention,
    });
    await executeTurn(get, set, message, intention);
  },

  retryTurn: async () => {
    const state = get();
    if (
      state.status !== 'error' ||
      !state.pendingMessage ||
      !state.pendingIntention ||
      state.mode !== 'playing'
    ) {
      return;
    }
    set({ status: 'loading', error: null });
    await executeTurn(
      get,
      set,
      state.pendingMessage,
      state.pendingIntention
    );
  },

  pause: () => {
    if (get().mode === 'playing') set({ mode: 'paused' });
  },

  resume: () => {
    const state = get();
    if (state.mode !== 'paused') return;
    set({
      mode:
        state.turnIndex >= SCENARIO.totalTurns && state.closingMessage
          ? 'closing'
          : 'playing',
    });
  },

  continueToOutcome: () => {
    if (get().mode === 'closing') set({ mode: 'outcome' });
  },

  restart: () => {
    const runId = get().runId + 1;
    set({ ...createInitialState(runId), mode: 'prologue', prologuePart: 0 });
  },

  returnToTitle: () => {
    const runId = get().runId + 1;
    set(createInitialState(runId));
  },
}));
