import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, useGameStore } from '../src/game/store';
import { SCENARIO } from '../src/game/scenario';
import type { PlayerIntent, TurnAssessment, TurnResponse } from '../src/game/types';
import { CLOSURES, makeAssessment, makeTurnResponse } from './helpers';

const postTurnMock = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/turnClient', () => ({ postTurn: postTurnMock }));

function state() {
  return useGameStore.getState();
}

function enterPlaying() {
  state().start();
  state().continueFromPrologue();
}

function prepareSubmission(
  text = 'What hurt most?',
  intention: PlayerIntent = 'understand'
) {
  state().setInput(text);
  state().selectIntention(intention);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  useGameStore.setState(createInitialState(0));
  postTurnMock.mockReset();
  postTurnMock.mockResolvedValue(makeTurnResponse());
});

describe('application flow', () => {
  it('starts in title mode', () => expect(state().mode).toBe('title'));
  it('start enters prologue', () => { state().start(); expect(state().mode).toBe('prologue'); });
  it('continue enters playing and adds opening once', () => {
    state().start();
    state().continueFromPrologue();
    state().continueFromPrologue();
    expect(state().mode).toBe('playing');
    expect(state().transcript).toEqual([{ speaker: 'character', text: SCENARIO.openingLine }]);
  });
  it('selects intention and changes input', () => {
    state().selectIntention('repair'); state().setInput('Hello');
    expect(state()).toMatchObject({ selectedIntention: 'repair', input: 'Hello' });
  });
  it('pause and resume preserve the run', () => {
    enterPlaying(); state().pause(); expect(state().mode).toBe('paused');
    state().resume(); expect(state().mode).toBe('playing');
  });
  it('restart resets gameplay and enters prologue', () => {
    enterPlaying(); prepareSubmission(); state().restart();
    expect(state()).toMatchObject({ mode: 'prologue', turnIndex: 0, input: '', selectedIntention: null, transcript: [] });
  });
  it('returnToTitle resets gameplay', () => {
    enterPlaying(); prepareSubmission(); state().returnToTitle();
    expect(state()).toMatchObject({ mode: 'title', turnIndex: 0, input: '', selectedIntention: null, transcript: [] });
  });
});

describe('submission safety', () => {
  it('requires non-empty input', async () => {
    enterPlaying(); state().selectIntention('understand'); await state().submitTurn();
    expect(postTurnMock).not.toHaveBeenCalled();
  });
  it('requires an intention', async () => {
    enterPlaying(); state().setInput('Hello'); await state().submitTurn();
    expect(postTurnMock).not.toHaveBeenCalled();
  });
  it.each(['title', 'prologue', 'paused', 'closing', 'outcome'] as const)(
    'blocks submission in %s mode', async (mode) => {
      useGameStore.setState({ mode }); prepareSubmission(); await state().submitTurn();
      expect(postTurnMock).not.toHaveBeenCalled();
    }
  );
  it('blocks duplicate activation while loading', async () => {
    enterPlaying(); prepareSubmission(); const pending = deferred<TurnResponse>();
    postTurnMock.mockReturnValue(pending.promise);
    const first = state().submitTurn(); const second = state().submitTurn();
    expect(postTurnMock).toHaveBeenCalledOnce();
    pending.resolve(makeTurnResponse()); await Promise.all([first, second]);
  });
  it('trims the committed request text', async () => {
    enterPlaying(); prepareSubmission('  Exact words  '); await state().submitTurn();
    expect(postTurnMock.mock.calls[0][0].playerText).toBe('Exact words');
  });
  it('includes the selected intention in request and history', async () => {
    enterPlaying(); prepareSubmission('I am sorry.', 'acknowledge'); await state().submitTurn();
    expect(postTurnMock.mock.calls[0][0].selectedIntention).toBe('acknowledge');
    expect(state().assessments[0].selectedIntent).toBe('acknowledge');
  });
  it('one success adds one turn, two transcript entries, and one assessment', async () => {
    enterPlaying(); prepareSubmission(); const before = state().transcript.length;
    await state().submitTurn();
    expect(state().turnIndex).toBe(1);
    expect(state().transcript).toHaveLength(before + 2);
    expect(state().assessments).toHaveLength(1);
  });
  it('success clears input, intention, and pending retry data', async () => {
    enterPlaying(); prepareSubmission(); await state().submitTurn();
    expect(state()).toMatchObject({ input: '', selectedIntention: null, pendingMessage: null, pendingIntention: null, status: 'idle' });
  });
  it('blocks a sixteenth turn', async () => {
    enterPlaying(); useGameStore.setState({ turnIndex: 15 }); prepareSubmission();
    await state().submitTurn(); expect(postTurnMock).not.toHaveBeenCalled();
  });
});

describe('failure, retry, and stale requests', () => {
  it('failure preserves input, intention, and pending retry data', async () => {
    enterPlaying(); prepareSubmission('Keep this', 'repair');
    postTurnMock.mockRejectedValueOnce(new Error('Safe failure')); await state().submitTurn();
    expect(state()).toMatchObject({ status: 'error', input: 'Keep this', selectedIntention: 'repair', pendingMessage: 'Keep this', pendingIntention: 'repair', turnIndex: 0 });
  });
  it('successful retry consumes exactly one turn without duplicates', async () => {
    enterPlaying(); prepareSubmission(); postTurnMock.mockRejectedValueOnce(new Error('fail'));
    await state().submitTurn(); postTurnMock.mockResolvedValueOnce(makeTurnResponse());
    await state().retryTurn();
    expect(state().turnIndex).toBe(1); expect(state().transcript).toHaveLength(3); expect(state().assessments).toHaveLength(1);
  });
  it('blocks simultaneous duplicate retry', async () => {
    enterPlaying(); prepareSubmission(); postTurnMock.mockRejectedValueOnce(new Error('fail')); await state().submitTurn();
    const pending = deferred<TurnResponse>(); postTurnMock.mockReturnValue(pending.promise);
    const first = state().retryTurn(); const second = state().retryTurn();
    expect(postTurnMock).toHaveBeenCalledTimes(2); pending.resolve(makeTurnResponse()); await Promise.all([first, second]);
  });
  it('ignores an in-flight response after restart', async () => {
    enterPlaying(); prepareSubmission(); const pending = deferred<TurnResponse>(); postTurnMock.mockReturnValue(pending.promise);
    const request = state().submitTurn(); state().restart(); pending.resolve(makeTurnResponse()); await request;
    expect(state()).toMatchObject({ mode: 'prologue', turnIndex: 0, transcript: [] });
  });
  it('ignores an in-flight response after return to title', async () => {
    enterPlaying(); prepareSubmission(); const pending = deferred<TurnResponse>(); postTurnMock.mockReturnValue(pending.promise);
    const request = state().submitTurn(); state().returnToTitle(); pending.resolve(makeTurnResponse()); await request;
    expect(state()).toMatchObject({ mode: 'title', turnIndex: 0, transcript: [] });
  });
  it('keeps paused mode when an ordinary response completes', async () => {
    enterPlaying(); prepareSubmission(); const pending = deferred<TurnResponse>(); postTurnMock.mockReturnValue(pending.promise);
    const request = state().submitTurn(); state().pause(); pending.resolve(makeTurnResponse()); await request;
    expect(state()).toMatchObject({ mode: 'paused', turnIndex: 1 });
    state().resume(); expect(state().mode).toBe('playing');
  });
});

describe('turn-15 closing and outcome flow', () => {
  beforeEach(() => {
    enterPlaying();
    const assessments: TurnAssessment[] = Array.from({ length: 14 }, () => makeAssessment('repair', 'repair'));
    useGameStore.setState({ turnIndex: 14, assessments, engagement: 8, tension: 0 });
    postTurnMock.mockResolvedValue(makeTurnResponse({ finalClosures: CLOSURES, assessment: { perceivedImpact: 'repair', impactReason: 'It left room.', engagementDelta: 1, tensionDelta: -1 } }));
    prepareSubmission('I will respect your boundary.', 'repair');
  });
  it('enters closing before outcome and selects code-owned matching closure', async () => {
    await state().submitTurn();
    expect(state().mode).toBe('closing'); expect(state().outcome?.id).toBe('even'); expect(state().closingMessage).toBe(CLOSURES.even);
  });
  it('continues to outcome only from closing', async () => {
    state().continueToOutcome(); expect(state().mode).toBe('playing');
    await state().submitTurn(); state().continueToOutcome(); expect(state().mode).toBe('outcome');
  });
  it('blocks submission from closing and outcome', async () => {
    await state().submitTurn(); prepareSubmission(); await state().submitTurn(); expect(postTurnMock).toHaveBeenCalledOnce();
    state().continueToOutcome(); await state().submitTurn(); expect(postTurnMock).toHaveBeenCalledOnce();
  });
  it('resumes into closing when the final response completed while paused', async () => {
    const pending = deferred<TurnResponse>(); postTurnMock.mockReturnValue(pending.promise);
    const request = state().submitTurn(); state().pause(); pending.resolve(makeTurnResponse({ finalClosures: CLOSURES, assessment: { perceivedImpact: 'repair', impactReason: 'It left room.', engagementDelta: 1, tensionDelta: -1 } })); await request;
    expect(state().mode).toBe('paused'); state().resume(); expect(state().mode).toBe('closing');
  });
});
