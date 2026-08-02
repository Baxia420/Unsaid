import { useRef, useEffect } from 'react';
import { SCENARIO } from '../game/scenario';
import { useGameStore } from '../game/store';
import type { PortraitState } from '../game/types';
import './ConversationScene.css';

// Portrait asset helpers — provide stable hooks for final artwork
const PORTRAIT_OPEN: Record<PortraitState, string> = {
  distant:      'assets/friend/distant-open.webp',
  defensive:    'assets/friend/defensive-open.webp',
  hurt_exposed: 'assets/friend/hurt_exposed-open.webp',
  connected:    'assets/friend/connected-open.webp',
};

const PORTRAIT_CLOSED: Record<PortraitState, string> = {
  distant:      'assets/friend/distant-closed.webp',
  defensive:    'assets/friend/defensive-closed.webp',
  hurt_exposed: 'assets/friend/hurt_exposed-closed.webp',
  connected:    'assets/friend/connected-closed.webp',
};

const BLINK_SRC = 'assets/friend/blink.webp';

// Map portrait state to intentional placeholder visual tone
// These are data attributes only — not visible labels to the player
const PORTRAIT_DATA_STATE: Record<PortraitState, string> = {
  distant:      'distant',
  defensive:    'defensive',
  hurt_exposed: 'hurt-exposed',
  connected:    'connected',
};

export default function ConversationScene() {
  const {
    transcript,
    portraitState,
    input,
    status,
    error,
    mode,
    outcome,
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

  // Keep textarea focused when mode changes
  useEffect(() => {
    if (!isComplete && !isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode, isLoading, isComplete]);

  // Most recent character line — shown in the scene stage
  const lastCharacterLine = [...transcript]
    .reverse()
    .find((e) => e.speaker === 'character')?.text ?? null;

  // Most recent player line (one subtle echo) — only when not at turn 0
  const lastPlayerLine = transcript.length > 1
    ? [...transcript].reverse().find((e) => e.speaker === 'player')?.text ?? null
    : null;

  // Portrait asset path — open/closed determined by loading (mouth open = speaking)
  const portraitSrc = isLoading
    ? PORTRAIT_OPEN[portraitState]
    : PORTRAIT_CLOSED[portraitState];

  const blinkSrc = BLINK_SRC;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) submitTurn();
    }
  };

  // ── OUTCOME SCENE ────────────────────────────────────────────────────────────
  if (isComplete && outcome) {
    return (
      <div
        className="cs-root cs-outcome-mode"
        data-scene-mode="outcome"
        aria-label="Outcome scene"
      >
        <div className="cs-outcome-card" role="main">
          <div className="cs-outcome-title">{outcome.title}</div>
          <p className="cs-outcome-description">{outcome.description}</p>
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
      data-scene-mode={isRehearsing ? 'rehearsing' : 'reality'}
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
              className="cs-portrait-img cs-portrait-closed"
              src={PORTRAIT_CLOSED[portraitState]}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <img
              className="cs-portrait-img cs-portrait-open"
              src={portraitSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <img
              className="cs-portrait-img cs-portrait-blink"
              src={blinkSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            {/* Silhouette placeholder — visible before artwork arrives */}
            <div
              className="cs-portrait-silhouette"
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
