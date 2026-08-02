import { useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../game/store';
import { TurnClientError } from '../lib/turnClient';
import { getCurrentBeat, isRehearsalTurn } from '../game/engine';
import { SCENARIO } from '../game/scenario';
import { evaluateOutcome } from '../game/outcome';
import type { PortraitState, TranscriptEntry, OutcomeDef } from '../game/types';
import './ConversationScene.css';

export default function ConversationScene() {
  const {
    transcript,
    engagement,
    tension,
    portraitState,
    turnIndex,
    input,
    status,
    error: storeError,
    mode,
    outcome: storeOutcome,
    imaginedResponse,
    setInput,
    submitTurn,
    retryTurn,
    restart,
  } = useGameStore();

  const [hasUsedRehearse, setHasUsedRehearse] = useState(false);
  const [hadRehearseDraft, setHadRehearseDraft] = useState(false);
  const [hasJustSnapped, setHasJustSnapped] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const currentBeat = getCurrentBeat(turnIndex);
  const isRehearsing = isRehearsalTurn(turnIndex);
  const allTurnsPlayed = turnIndex >= SCENARIO.totalTurns;

  const outcome = useMemo<OutcomeDef | null>(() => {
    if (storeOutcome) return storeOutcome;
    if (!allTurnsPlayed) return null;
    const assessments = useGameStore.getState().assessments;
    const outcomeId = evaluateOutcome({
      intents: assessments.map((a) => a.intent),
      finalEngagement: engagement,
      finalTension: tension,
    });
    return SCENARIO.outcomes[outcomeId] ?? null;
  }, [storeOutcome, allTurnsPlayed, engagement, tension]);

  const sceneMode = useMemo(() => {
    if (status === 'loading') return 'submitting';
    if (storeError || localError) return 'error';
    if (allTurnsPlayed) return 'outcome';
    if (mode === 'rehearsing') return 'rehearsing';
    return 'reality';
  }, [status, storeError, localError, allTurnsPlayed, mode]);

  const effectivePortraitState = useMemo<PortraitState>(() => {
    if (outcome) return 'connected';
    return portraitState;
  }, [portraitState, outcome]);

  const mouthState = useMemo(() => {
    if (status === 'loading') return 'closed';
    if (currentResponse) return 'open';
    if (mode === 'rehearsing' && hasUsedRehearse) return 'open';
    return 'closed';
  }, [status, currentResponse, mode, hasUsedRehearse]);

  const visibleHistory = useMemo(() => {
    return transcript.slice(-4, -1);
  }, [transcript]);

  const currentPrompt = useMemo(() => {
    if (currentResponse) return currentResponse;
    if (mode === 'rehearsing' && hasUsedRehearse && imaginedResponse) {
      return imaginedResponse;
    }
    const lastEntry = transcript[transcript.length - 1];
    if (lastEntry?.speaker === 'character') return lastEntry.text;
    return '';
  }, [currentResponse, mode, hasUsedRehearse, imaginedResponse, transcript]);

  const tensionPct = 50 + tension;
  const engagementPct = 50 + engagement;

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, [setInput]);

  const handleRehearse = useCallback(() => {
    if (!imaginedResponse) return;
    setInput(imaginedResponse);
    setHasUsedRehearse(true);
    setHadRehearseDraft(true);
  }, [imaginedResponse, setInput]);

  const handleSay = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !currentBeat) return;
    if (isRehearsing && !hadRehearseDraft) {
      setLocalError('Please draft your words before saying them.');
      return;
    }

    setLocalError(null);
    setHasJustSnapped(true);

    try {
      await submitTurn();
      const latestTranscript = useGameStore.getState().transcript;
      const lastChar = latestTranscript[latestTranscript.length - 1];
      if (lastChar?.speaker === 'character') {
        setCurrentResponse(lastChar.text);
      }
      setHasUsedRehearse(false);
      setHadRehearseDraft(false);
    } catch (err) {
      setLocalError(err instanceof TurnClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setHasJustSnapped(false);
    }
  }, [input, currentBeat, isRehearsing, hadRehearseDraft, submitTurn]);

  const handleRestart = useCallback(() => {
    restart();
    setHasUsedRehearse(false);
    setHadRehearseDraft(false);
    setHasJustSnapped(false);
    setCurrentResponse(null);
    setLocalError(null);
  }, [restart]);

  const handleRetry = useCallback(() => {
    retryTurn();
  }, [retryTurn]);

  return (
    <section
      className="cinematic-shell"
      data-scene-mode={sceneMode}
      data-has-snapped={hasJustSnapped}
      aria-label="Cinematic conversation scene"
    >
      {/* Screen-reader transcript: full history preserved in state */}
      <div className="sr-only transcript" aria-live="polite">
        <h2>Conversation transcript</h2>
        <ol>
          {transcript.map((entry: TranscriptEntry, i: number) => (
            <li key={i}>
              <span>{entry.speaker === 'player' ? 'Player' : 'Character'}: {entry.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Background layers */}
      <div className="bg-layer" aria-hidden="true">
        <div className="cafe-bg" role="img" aria-label="Quiet cafe table beside a window, mid-afternoon" />
        <div className="cafe-window" />
      </div>

      {/* Portrait layer */}
      <div className="portrait-layer">
        <div
          className="portrait"
          data-portrait-state={effectivePortraitState}
          data-mouth={mouthState}
          aria-label={`Friend portrait: ${effectivePortraitState}`}
        >
          <div className="portrait-placeholder" aria-hidden="true" />
          <div className="portrait-blink" aria-hidden="true" />
          <div className="portrait-breathing" aria-hidden="true" />
          <div className="portrait-look-away" aria-hidden="true" />
        </div>
      </div>

      {/* Foreground layer */}
      <div className="foreground-layer" aria-hidden="true">
        <div className="table-foreground" />
        <div className="drink-object" role="img" aria-label="Untouched drink on the table" />
      </div>

      {/* Dialogue layer */}
      <div className="dialogue-layer">
        <div className="dialogue-history" aria-hidden="true">
          {visibleHistory.map((entry: TranscriptEntry, i: number) => (
            <div key={i} className="exchange">
              {entry.speaker === 'player' ? (
                <span className="exchange-player">{entry.text}</span>
              ) : (
                <span className="exchange-character">{entry.text}</span>
              )}
            </div>
          ))}
        </div>

        <div className="dialogue-current">
          {status === 'loading' ? (
            <div className="thinking-indicator" aria-label="Character is thinking">
              <span className="thinking-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          ) : mode === 'rehearsing' && hasUsedRehearse && imaginedResponse ? (
            <div className="dialogue-rehearsed">
              <p className="character-text">{imaginedResponse}</p>
            </div>
          ) : currentResponse ? (
            <p className="character-text">{currentResponse}</p>
          ) : (
            <p className="character-text prompt">{currentPrompt}</p>
          )}
        </div>
      </div>

      {/* Input / Outcome layer */}
      <div className="input-layer">
        {allTurnsPlayed ? (
          <div className="outcome-overlay">
            <h2 className="outcome-title">{outcome?.title ?? ''}</h2>
            <p className="outcome-description">{outcome?.description ?? ''}</p>
            <div className="state-bars">
              <div className="bar">
                <span className="bar-label">Tension</span>
                <div className="bar-track">
                  <div
                    className="bar-fill tension"
                    style={{ width: `${tensionPct}%` }}
                    aria-label={`Tension ${tensionPct}%`}
                  />
                </div>
                <span className="bar-value">{tensionPct}%</span>
              </div>
              <div className="bar">
                <span className="bar-label">Engagement</span>
                <div className="bar-track">
                  <div
                    className="bar-fill engagement"
                    style={{ width: `${engagementPct}%` }}
                    aria-label={`Engagement ${engagementPct}%`}
                  />
                </div>
                <span className="bar-value">{engagementPct}%</span>
              </div>
            </div>
            <button
              className="restart-button"
              onClick={handleRestart}
              type="button"
            >
              Restart
            </button>
          </div>
        ) : (
          <div className="input-controls">
            {mode === 'rehearsing' && !hasUsedRehearse && imaginedResponse && (
              <div className="rehearse-prompt">
                <span className="rehearse-label">Rehearsing</span>
                <p className="rehearse-text">
                  The words feel rehearsed. Imagine: {imaginedResponse}
                </p>
                <button
                  className="rehearse-button"
                  onClick={handleRehearse}
                  type="button"
                >
                  REHEARSE
                </button>
              </div>
            )}

            <label className="input-label" htmlFor="player-input">
              What do you say?
            </label>
            <input
              id="player-input"
              className="player-input"
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Type your response here..."
              disabled={status === 'loading'}
              maxLength={500}
              aria-label="Player response"
            />
            {status === 'loading' && (
              <span className="submitting-indicator" aria-label="Submitting">
                Submitting...
              </span>
            )}
            {(storeError || localError) && (
              <div className="error-message" role="alert">
                {storeError || localError}
                {status === 'error' && (
                  <button
                    className="retry-button"
                    onClick={handleRetry}
                    type="button"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            <div className="action-buttons">
              {mode === 'rehearsing' && hasUsedRehearse && (
                <button
                  className="snap-button say-button"
                  onClick={handleSay}
                  type="button"
                  disabled={status === 'loading' || !input.trim()}
                >
                  SAY
                </button>
              )}
              {mode !== 'rehearsing' && (
                <button
                  className="say-button"
                  onClick={handleSay}
                  type="button"
                  disabled={status === 'loading' || !input.trim()}
                >
                  {status === 'loading' ? 'Sending...' : 'SAY'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
