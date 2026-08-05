import { useRef, useState, useCallback } from 'react';
import { SCENARIO } from '../game/scenario';
import { useGameStore } from '../game/store';
import {
  PORTRAIT_CLOSED,
  PORTRAIT_DATA_STATE,
  BLINK_SRC,
} from './cinematicPresentation';
import type { VisualSceneState } from './cinematicPresentation';
import { buildOutcomeReflection } from '../game/reflection';
import type { PortraitState } from '../game/types';
import './ConversationScene.css';

// Visual-only ephemeral mouth-open state after a new character response.
// Does NOT affect store, transcript, turns, API calls, timing, or outcome.
const MOUTH_OPEN_DURATION_MS = 1200;

export default function ConversationScene() {
  const {
    transcript,
    portraitState,
    input,
    status,
    error,
    mode,
    outcome,
    assessments,
    imaginedResponse,
    setInput,
    submitTurn,
    retryTurn,
    restart,
  } = useGameStore();

  const isLoading   = status === 'loading';
  const isError     = status === 'error';
  const isComplete  = mode === 'outcome';
  const isRehearsing = mode === 'rehearsing';
  const canSubmit   = input.trim().length > 0 && !isLoading && !isComplete;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ephemeral mouth-open state: triggered when a new character line arrives.
  const [mouthOpen, setMouthOpen] = useState(false);
  const mouthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadedPortraitStates, setLoadedPortraitStates] = useState<Set<PortraitState>>(
    () => new Set()
  );
  const [failedPortraitSources, setFailedPortraitSources] = useState<Set<string>>(
    () => new Set()
  );

  // Track last character line to detect new arrivals
  const lastCharacterLine = [...transcript]
    .reverse()
    .find((e) => e.speaker === 'character')?.text ?? null;

  const prevLineRef = useRef<string | null>(null);
  if (lastCharacterLine && lastCharacterLine !== prevLineRef.current) {
    prevLineRef.current = lastCharacterLine;
    if (mouthTimerRef.current) clearTimeout(mouthTimerRef.current);
    setMouthOpen(true);
    mouthTimerRef.current = setTimeout(() => setMouthOpen(false), MOUTH_OPEN_DURATION_MS);
  }

  // Most recent player line (one subtle echo) — only when not at turn 0
  const lastPlayerLine = transcript.length > 1
    ? [...transcript].reverse().find((e) => e.speaker === 'player')?.text ?? null
    : null;

  // Loading = thinking = closed mouth. New response = brief open mouth.
  const portraitSrc = isLoading || !mouthOpen
    ? PORTRAIT_CLOSED[portraitState]
    : PORTRAIT_CLOSED[portraitState].replace('-closed', '-open');

  const blinkSrc = BLINK_SRC;

  const handlePortraitLoad = useCallback((state: PortraitState) => {
    setLoadedPortraitStates((loaded) => {
      if (loaded.has(state)) return loaded;
      const next = new Set(loaded);
      next.add(state);
      return next;
    });
  }, []);

  // Graceful image-error handler: hide only the failed image and retain the
  // intentional silhouette fallback for the active state.
  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  }, []);
  const handlePortraitError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    handleImgError(e);
    setFailedPortraitSources((failed) => new Set(failed).add(portraitSrc));
  }, [handleImgError, portraitSrc]);
  const portraitLoaded = loadedPortraitStates.has(portraitState)
    && !failedPortraitSources.has(portraitSrc);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) submitTurn();
    }
  };

  // Visual scene-state attribute (presentation only)
  const visualSceneState: VisualSceneState = isComplete
    ? 'outcome'
    : isError
      ? 'error'
      : isLoading
        ? 'submitting'
        : isRehearsing
          ? 'rehearsing'
          : 'reality';

  // ── OUTCOME SCENE ────────────────────────────────────────────────────────────
  if (isComplete && outcome) {
    const reflection = buildOutcomeReflection(outcome.id, transcript, assessments);
    return (
      <div
        className="cs-root cs-outcome-mode"
        data-scene-mode="outcome"
        aria-label="Outcome scene"
      >
        <div className="cs-outcome-card" role="main">
          <h1 className="cs-outcome-title">{outcome.title}</h1>
          <p className="cs-outcome-description">{outcome.description}</p>
          {reflection.quote && (
            <figure className="cs-outcome-reflection">
              <figcaption>One thing you said</figcaption>
              <blockquote>&ldquo;{reflection.quote}&rdquo;</blockquote>
              <p>{reflection.explanation}</p>
            </figure>
          )}
          <button
            type="button"
            className="cs-restart-btn"
            onClick={restart}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  // ── CONVERSATION SCENE ───────────────────────────────────────────────────────
  return (
    <div
      className={`cs-root${isRehearsing ? ' cs-rehearse-mode' : ' cs-reality-mode'}`}
      data-scene-mode={visualSceneState}
      aria-label="Conversation scene"
    >
      {/* ── REGION 1: SCENE STAGE ── */}
      <section className="cs-stage" aria-label="Scene stage">
        {/* Art canvas — absolute positioning is confined here */}
        <div className="cs-art-canvas" aria-hidden="true">
          <div className="cs-background" />
          <div
            className="cs-portrait-frame"
            data-portrait-state={PORTRAIT_DATA_STATE[portraitState]}
          >
            <img
              key={portraitSrc}
              className="cs-portrait-img"
              src={portraitSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              onLoad={() => handlePortraitLoad(portraitState)}
              onError={handlePortraitError}
            />
            <img
              className="cs-portrait-img cs-portrait-blink"
              src={blinkSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              onError={handleImgError}
            />
            {/* Silhouette placeholder — visible before artwork arrives */}
            <div
              className={`cs-portrait-silhouette${portraitLoaded ? ' cs-portrait-silhouette--hidden' : ''}`}
              data-portrait-state={PORTRAIT_DATA_STATE[portraitState]}
              aria-hidden="true"
            />
          </div>
          <div className="cs-table-foreground" />
        </div>

        {/* Prior player echo — one subtle line, not a full transcript */}
        {lastPlayerLine && (
          <div className="cs-prior-player-echo" aria-label="Your last words">
            <span className="cs-prior-player-text">{lastPlayerLine}</span>
          </div>
        )}

        {/* Current character dialogue card */}
        {lastCharacterLine && (
          <div
            className="cs-dialogue-card"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="cs-dialogue-text">{lastCharacterLine}</p>
          </div>
        )}
      </section>

      {/* ── REGION 2: INTERACTION DOCK ── */}
      <section className="cs-dock" aria-label="Interaction dock">
        {/* Mode/context strip */}
        <div className="cs-mode-strip" aria-hidden="true">
          {isRehearsing ? (
            <span className="cs-mode-tag cs-mode-tag--rehearse">
              Imagining — what might she say?
            </span>
          ) : (
            <span className="cs-mode-tag cs-mode-tag--reality">
              {isLoading ? 'She\'s thinking…' : 'Reality'}
            </span>
          )}
        </div>

        {/* Imagined response panel — only during REHEARSE when draft is present */}
        {isRehearsing && input.trim().length > 0 && imaginedResponse && (
          <div
            className="cs-imagined-panel"
            aria-label="Imagined response"
            role="region"
          >
            <div className="cs-imagined-label" aria-hidden="true">
              In your mind, she might say —
            </div>
            <blockquote className="cs-imagined-text">
              {imaginedResponse}
            </blockquote>
          </div>
        )}

        {/* Error panel */}
        {isError && (
          <div
            className="cs-error-panel"
            role="alert"
            aria-live="assertive"
          >
            <span className="cs-error-text">{error}</span>
            <button
              type="button"
              className="cs-retry-btn"
              onClick={retryTurn}
              disabled={isLoading}
            >
              Retry
            </button>
          </div>
        )}

        {/* Input form */}
        <div className="cs-input-row">
          <textarea
            ref={textareaRef}
            className="cs-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRehearsing
                ? 'Draft what you want to say…'
                : 'Say something…'
            }
            rows={3}
            disabled={isLoading}
            maxLength={SCENARIO.maxPlayerTextLength}
            autoComplete="off"
            name="unsaid-player-dialogue"
            autoCapitalize="sentences"
            spellCheck={true}
            aria-label={isRehearsing ? 'Rehearsal draft' : 'Your message'}
          />
          <button
            type="button"
            className={`cs-say-btn${isLoading ? ' cs-say-btn--loading' : ''}`}
            onClick={submitTurn}
            disabled={!canSubmit}
            aria-label={
              isLoading
                ? 'Sending…'
                : isRehearsing
                  ? 'Say it for real'
                  : 'Send message'
            }
          >
            {isLoading ? (
              <span className="cs-thinking-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            ) : (
              <span>{isRehearsing ? 'SAY' : 'Send'}</span>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
