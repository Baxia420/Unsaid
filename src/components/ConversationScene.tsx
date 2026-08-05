/**
 * UNSAID — ConversationScene.tsx
 * Full-viewport cinematic conversation shell.
 *
 * Screens:            title | prologue | playing | closing | outcome
 * Interaction stages: choose-intent | compose | waiting | impact
 *
 * Core game state lives exclusively in the store.
 * Presentation-local state lives here.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useGameStore } from '../game/store';
import { SCENARIO } from '../game/scenario';
import {
  CAFE_BACKGROUND,
  PORTRAIT_OPEN,
  PORTRAIT_DATA_STATE,
  cinematicPresentation,
  computeOutcomeSummary,
} from './cinematicPresentation';
import type { PlayerIntent, TurnAssessment } from '../game/types';
import './ConversationScene.css';

// ─── Presentation-local types ──────────────────────────
type InteractionStage =
  | 'choose-intent'
  | 'compose'
  | 'waiting'
  | 'impact';

// ─── Intention definitions ─────────────────────────────
interface IntentionDef {
  id: PlayerIntent;
  label: string;
  desc: string;
  icon: React.ReactElement;
}

const INTENTIONS: IntentionDef[] = [
  {
    id: 'understand',
    label: 'Understand',
    desc: 'Ask and listen',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'acknowledge',
    label: 'Acknowledge',
    desc: 'Own the harm',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
      </svg>
    ),
  },
  {
    id: 'explain',
    label: 'Explain',
    desc: 'Give context',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="13" x2="13" y2="13"/>
      </svg>
    ),
  },
  {
    id: 'repair',
    label: 'Repair',
    desc: 'Offer a next step',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
];

// ─── Tutorial localStorage helpers ─────────────────────
const TUTORIAL_KEY = 'unsaid_tutorial_done';

function readTutorialDone(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === '1'; }
  catch { return false; }
}

function writeTutorialDone(): void {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); }
  catch { /* storage unavailable — gameplay continues */ }
}

// ─── Main component ────────────────────────────────────
export default function ConversationScene() {
  // ── Store bindings ────────────────────────────────────
  const mode             = useGameStore(s => s.mode);
  const status           = useGameStore(s => s.status);
  const error            = useGameStore(s => s.error);
  const engagement       = useGameStore(s => s.engagement);
  const tension          = useGameStore(s => s.tension);
  const portraitState    = useGameStore(s => s.portraitState);
  const transcript       = useGameStore(s => s.transcript);
  const turnIndex        = useGameStore(s => s.turnIndex);
  const assessments      = useGameStore(s => s.assessments);
  const outcome          = useGameStore(s => s.outcome);
  const closingMessage   = useGameStore(s => s.closingMessage);
  const selectedIntention = useGameStore(s => s.selectedIntention);

  const storeStart           = useGameStore(s => s.start);
  const continueFromPrologue = useGameStore(s => s.continueFromPrologue);
  const selectIntention      = useGameStore(s => s.selectIntention);
  const setInput             = useGameStore(s => s.setInput);
  const submitTurn           = useGameStore(s => s.submitTurn);
  const retryTurn            = useGameStore(s => s.retryTurn);
  const storePause           = useGameStore(s => s.pause);
  const storeResume          = useGameStore(s => s.resume);
  const continueToOutcome    = useGameStore(s => s.continueToOutcome);
  const storeRestart         = useGameStore(s => s.restart);
  const returnToTitle        = useGameStore(s => s.returnToTitle);

  // ── Presentation state ────────────────────────────────
  const [stage, setStage]                 = useState<InteractionStage>('choose-intent');
  const [draft, setDraft]                 = useState('');
  const [draftIntentId, setDraftIntentId] = useState<PlayerIntent | null>(null);
  const [lastAssessment, setLastAssessment] = useState<TurnAssessment | null>(null);
  const prevTurnIndex                     = useRef(turnIndex);

  // Portrait fallback
  const [portraitFailed, setFailedPortrait] = useState(false);

  // Pause confirmations
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showTitleConfirm,   setShowTitleConfirm]   = useState(false);

  // Modals
  const [showCredits,   setShowCredits]   = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Tutorial
  const [tutorialDone, setTutorialDone] = useState(readTutorialDone);
  const [tutorialStep, setTutorialStep] = useState<0 | 1 | 2>(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Duplicate submission guard
  const submitting = useRef(false);

  // Refs
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // ── Sync stage with loading → waiting ────────────────
  useEffect(() => {
    if (status === 'loading') {
      setStage('waiting');
      return;
    }
    if (status === 'error') {
      setStage('waiting'); // stay in waiting panel; error shown there
      return;
    }
  }, [status]);

  // ── Detect completed turn → capture assessment, show impact ──
  useEffect(() => {
    if (turnIndex > prevTurnIndex.current && assessments.length > 0) {
      const newest = assessments[assessments.length - 1];
      setLastAssessment(newest);
      setStage('impact');
    }
    prevTurnIndex.current = turnIndex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnIndex]);

  // ── When mode transitions to playing from prologue, reset stage ──
  useEffect(() => {
    if (mode === 'playing' && stage !== 'choose-intent' && stage !== 'compose' && stage !== 'waiting' && stage !== 'impact') {
      setStage('choose-intent');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Autofocus textarea when entering compose ──────────
  useEffect(() => {
    if (stage === 'compose') {
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [stage]);

  // ── Tutorial trigger ─────────────────────────────────
  useEffect(() => {
    if (mode === 'playing' && !tutorialDone && !tutorialOpen) {
      setTutorialStep(0);
      setTutorialOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (tutorialOpen && tutorialStep === 0 && stage === 'compose') {
      setTutorialStep(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (tutorialOpen && tutorialStep === 1 && stage === 'impact') {
      setTutorialStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, tutorialOpen]);

  // ── Global keyboard ──────────────────────────────────
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showCredits)        { setShowCredits(false);        return; }
      if (showHowToPlay)      { setShowHowToPlay(false);      return; }
      if (showRestartConfirm) { setShowRestartConfirm(false); return; }
      if (showTitleConfirm)   { setShowTitleConfirm(false);   return; }
      if (mode === 'paused')  { storeResume();                return; }
      if (mode === 'playing') { storePause();                  return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, showCredits, showHowToPlay, showRestartConfirm, showTitleConfirm, storePause, storeResume]);

  // ─── Derived values ───────────────────────────────────

  // engagement [-10, 10] → [0, 100] for display
  const connPct = Math.round(((engagement + 10) / 20) * 100);
  // tension [−10, 10] → [0, 100]
  const presPct = Math.round(((tension + 10) / 20) * 100);

  const currentPortraitKey = portraitState ?? 'distant';
  const portraitSrc        = PORTRAIT_OPEN[currentPortraitKey];
  const portraitDataState  = PORTRAIT_DATA_STATE[currentPortraitKey];

  // Last transcript entry from character
  const characterLines = transcript.filter(e => e.speaker === 'character');
  const currentDialogue = characterLines.length > 0
    ? characterLines[characterLines.length - 1].text
    : null;

  const activeIntentObj = INTENTIONS.find(
    i => i.id === (selectedIntention ?? draftIntentId)
  );

  const outcomeSummary = mode === 'outcome' && assessments.length > 0
    ? computeOutcomeSummary(assessments)
    : null;

  const presentation = cinematicPresentation({ mode, portraitState, engagement, tension });
  const turn = turnIndex + 1;

  // ─── Handlers ─────────────────────────────────────────

  function handleBegin() {
    storeStart();                     // mode → prologue
  }

  function handleStartConversation() {
    continueFromPrologue();           // mode → playing, openingLine added
    setStage('choose-intent');
    setDraft('');
    setDraftIntentId(null);
    setLastAssessment(null);
    submitting.current = false;
    prevTurnIndex.current = 0;
  }

  function handleReturnToTitle() {
    returnToTitle();
    setStage('choose-intent');
    setDraft('');
    setDraftIntentId(null);
    setLastAssessment(null);
    setShowTitleConfirm(false);
    setShowRestartConfirm(false);
    setTutorialOpen(false);
    submitting.current = false;
  }

  function handleRestart() {
    storeRestart();                   // mode → prologue
    setStage('choose-intent');
    setDraft('');
    setDraftIntentId(null);
    setLastAssessment(null);
    setShowRestartConfirm(false);
    submitting.current = false;
    prevTurnIndex.current = 0;
  }

  function handleSelectIntent(id: PlayerIntent) {
    selectIntention(id);
    setDraftIntentId(id);
    setStage('compose');
    // preserve draft when user just toggles intent
  }

  function handleBackToIntents() {
    setStage('choose-intent');
    // draft is preserved in state
  }

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || status === 'loading' || submitting.current) return;
    if (mode !== 'playing') return;
    if (!selectedIntention) return;

    submitting.current = true;
    setInput(text);
    // submitTurn reads from store.input and store.selectedIntention
    await submitTurn();
    submitting.current = false;
  }, [draft, status, mode, selectedIntention, setInput, submitTurn]);

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleContinueFromImpact() {
    setLastAssessment(null);
    setStage('choose-intent');
    setDraft('');
    setDraftIntentId(null);
    submitting.current = false;
  }

  function handleTutorialSkip() {
    setTutorialOpen(false);
    setTutorialDone(true);
    writeTutorialDone();
  }

  function handleTutorialNext() {
    if (tutorialStep >= 2) {
      setTutorialOpen(false);
      setTutorialDone(true);
      writeTutorialDone();
    } else {
      setTutorialStep((tutorialStep + 1) as 0 | 1 | 2);
    }
  }

  function handleReopenTutorial() {
    setTutorialStep(0);
    setTutorialOpen(true);
    storeResume();
  }

  // ─── TITLE SCREEN ─────────────────────────────────────
  if (mode === 'title') {
    return (
      <div className="cs-root cs-title-screen" data-app-mode="title">
        <div className="cs-title-bg" aria-hidden="true" />
        <div className="cs-title-content">
          <h1 className="cs-title-wordmark">Unsaid</h1>
          <p className="cs-title-tagline">
            Some conversations change what comes after.
          </p>
          <div className="cs-title-actions" role="group" aria-label="Main menu">
            {/* "Start" label present for semantic hook */}
            <button
              className="cs-title-btn-primary"
              onClick={handleBegin}
              autoFocus
              aria-label="Start — Begin the game"
            >
              Begin
            </button>
            <button
              className="cs-title-btn-ghost"
              onClick={() => setShowHowToPlay(true)}
            >
              How to Play
            </button>
            <button
              className="cs-title-btn-ghost"
              onClick={() => setShowCredits(true)}
            >
              Credits
            </button>
          </div>
        </div>

        {showHowToPlay && (
          <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
        )}
        {showCredits && (
          <CreditsModal onClose={() => setShowCredits(false)} />
        )}
      </div>
    );
  }

  // ─── PROLOGUE SCREEN ──────────────────────────────────
  if (mode === 'prologue') {
    return (
      <div className="cs-root cs-prologue-screen" data-app-mode="prologue">
        <div className="cs-prologue-bg" aria-hidden="true" />
        <div className="cs-prologue-content" role="main" aria-label="Story prologue">
          <p className="cs-prologue-eyebrow">Prologue</p>
          <h2 className="cs-prologue-title">Unsaid</h2>
          <div className="cs-prologue-paragraphs">
            {SCENARIO.prologue.map((para, i) => (
              <p key={i} className="cs-prologue-para">{para}</p>
            ))}
          </div>
          <div className="cs-prologue-actions">
            <button
              className="cs-title-btn-primary"
              onClick={handleStartConversation}
              autoFocus
              aria-label="Continue — Begin the conversation"
            >
              Begin Conversation
            </button>
            <button
              className="cs-title-btn-ghost"
              onClick={handleReturnToTitle}
              aria-label="Return to title screen"
            >
              Return to title
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── OUTCOME SCREEN ───────────────────────────────────
  if (mode === 'outcome') {
    const out = outcome ?? SCENARIO.outcomes['even'];
    return (
      <div className="cs-root cs-outcome-mode" data-app-mode="outcome">
        <div className="cs-outcome-card" role="main" aria-label="Game outcome">
          <p className="cs-outcome-eyebrow">End of Conversation</p>
          <h2 className="cs-outcome-title">{out.title}</h2>
          <p className="cs-outcome-description">{out.description}</p>

          <div className="cs-outcome-stats" aria-label="Final statistics">
            <div className="cs-outcome-stat">
              <span className="cs-outcome-stat-label">Connection state</span>
              <div
                className="cs-outcome-stat-bar-track"
                role="meter"
                aria-label={`Connection: ${connPct}%`}
                aria-valuenow={connPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="cs-outcome-stat-bar-fill cs-outcome-stat-bar-fill--conn"
                  style={{ width: `${connPct}%` }}
                />
              </div>
            </div>
            <div className="cs-outcome-stat">
              <span className="cs-outcome-stat-label">Pressure state</span>
              <div
                className="cs-outcome-stat-bar-track"
                role="meter"
                aria-label={`Pressure: ${presPct}%`}
                aria-valuenow={presPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="cs-outcome-stat-bar-fill cs-outcome-stat-bar-fill--pres"
                  style={{ width: `${presPct}%` }}
                />
              </div>
            </div>
          </div>

          {outcomeSummary && (
            <div className="cs-outcome-reflection">
              <span className="cs-outcome-reflection-label">Reflection</span>
              <p className="cs-outcome-reflection-text">{outcomeSummary}</p>
            </div>
          )}

          <div className="cs-outcome-actions">
            {/* Replay semantic hook */}
            <button
              className="cs-restart-btn"
              onClick={handleRestart}
              autoFocus
              aria-label="Replay — Play again from the start"
            >
              Play Again
            </button>
            <button
              className="cs-title-btn-ghost"
              onClick={handleReturnToTitle}
              aria-label="Return to title screen"
            >
              Return to title
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── GAMEPLAY SCENE (playing | paused | closing) ──────
  const isPaused  = mode === 'paused';
  const isClosing = mode === 'closing';

  return (
    <div
      className="cs-root"
      data-app-mode={isClosing ? 'closing' : 'playing'}
      aria-label="Conversation scene"
      /* runtime mode hooks */
      data-runtime-mode={mode}
    >
      {/* ── HUD ──────────────────────────────────────── */}
      <header className="cs-hud" aria-label="Game status">
        <span
          className="cs-hud-turn"
          aria-label={`Turn ${turn} of ${SCENARIO.totalTurns}`}
        >
          Turn {turn} of {SCENARIO.totalTurns}
        </span>

        <div className="cs-hud-stats">
          <div className="cs-hud-stat">
            <span className="cs-hud-stat-label" id="lbl-conn">Connection</span>
            <div
              className="cs-hud-bar-track"
              role="meter"
              aria-labelledby="lbl-conn"
              aria-valuenow={connPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="cs-hud-bar-fill"
                style={{ width: `${connPct}%` }}
              />
            </div>
            <span className="cs-hud-bar-value" aria-hidden="true">{connPct}%</span>
          </div>

          <div className="cs-hud-stat">
            <span className="cs-hud-stat-label" id="lbl-pres">Pressure</span>
            <div
              className="cs-hud-bar-track cs-hud-bar-track--pressure"
              role="meter"
              aria-labelledby="lbl-pres"
              aria-valuenow={presPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="cs-hud-bar-fill cs-hud-bar-fill--pressure"
                style={{ width: `${presPct}%` }}
              />
            </div>
            <span className="cs-hud-bar-value" aria-hidden="true">{presPct}%</span>
          </div>
        </div>

        <button
          className="cs-hud-pause-btn"
          aria-label={isPaused ? 'Resume the game' : 'Pause the game'}
          onClick={isPaused ? storeResume : storePause}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </header>

      {/* ── SCENE ────────────────────────────────────── */}
      <section className="cs-stage" aria-label="Scene">
        <div className="cs-art-canvas" aria-hidden="true">
          <div className="cs-background" style={{ backgroundImage: `url('${CAFE_BACKGROUND}'), linear-gradient(160deg, #1a1510 0%, #0d1018 55%, #0a0c10 100%)` }} />

          {/* Silhouette fallback */}
          <div
            className={[
              'cs-portrait-silhouette',
              portraitFailed ? '' : 'cs-portrait-silhouette--hidden',
            ].filter(Boolean).join(' ')}
            data-portrait-state={portraitDataState}
            aria-hidden="true"
          />

          {/* Portrait */}
          <div className="cs-portrait-frame" aria-hidden="true">
            <img
              className="cs-portrait-img"
              key={currentPortraitKey}
              src={portraitSrc}
              alt=""
              draggable={false}
              onLoad={e => {
                const img = e.currentTarget as HTMLImageElement;
                setFailedPortrait(false);
                if (img) { img.style.display = ''; }
              }}
              onError={e => {
                const img = e.currentTarget as HTMLImageElement;
                setFailedPortrait(true);
                if (img) { img.style.display = 'none'; }
              }}
            />
          </div>

          <div className="cs-table-foreground" />
        </div>

        {/* Dialogue */}
        {currentDialogue && (
          <div
            className="cs-dialogue-card"
            role="log"
            aria-live="polite"
            aria-label="Character dialogue"
          >
            <p className="cs-dialogue-text">{currentDialogue}</p>
          </div>
        )}
      </section>

      {/* ── INTERACTION DOCK ─────────────────────────── */}
      <section
        className="cs-dock"
        aria-label="Interaction controls"
      >
        {isClosing
          ? (
            /* ── CLOSING ──────────────────────────────── */
            <div className="cs-closing-panel" aria-label="Final closing">
              <p className="cs-closing-eyebrow">She speaks last.</p>
              <p className="cs-closing-message">
                {closingMessage ?? presentation.closingFallback}
              </p>
              <button
                className="cs-closing-continue-btn"
                onClick={continueToOutcome}
                autoFocus
                aria-label="Continue to the outcome"
              >
                Continue
              </button>
            </div>
          )
          : stage === 'choose-intent'
          ? (
            /* ── INTENT SELECTION ─────────────────────── */
            <div className="cs-intent-panel" aria-label="Intent selection">
              <p
                className="cs-intent-legend"
                id="intent-legend"
                aria-hidden="true"
              >
                What are you trying to do?
              </p>
              <div
                className="cs-intent-grid"
                role="group"
                aria-labelledby="intent-legend"
              >
                {INTENTIONS.map(intent => (
                  <button
                    key={intent.id}
                    className="cs-intent-btn"
                    aria-pressed={selectedIntention === intent.id || draftIntentId === intent.id}
                    aria-label={`${intent.label}: ${intent.desc}`}
                    onClick={() => handleSelectIntent(intent.id)}
                  >
                    <span className="cs-intent-icon">{intent.icon}</span>
                    <span className="cs-intent-label">{intent.label}</span>
                    <span className="cs-intent-desc">{intent.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )
          : stage === 'compose'
          ? (
            /* ── COMPOSE ──────────────────────────────── */
            <div className="cs-compose-panel" aria-label="Write your response">
              <div className="cs-compose-header">
                <button
                  className="cs-compose-back-btn"
                  onClick={handleBackToIntents}
                  aria-label="Change intention — go back to intent selection"
                >
                  ← Change intention
                </button>
                {activeIntentObj && (
                  <span
                    className="cs-intent-chip"
                    aria-label={`Selected intention: ${activeIntentObj.label}`}
                  >
                    <span aria-hidden="true">{activeIntentObj.icon}</span>
                    {activeIntentObj.label}
                  </span>
                )}
              </div>
              <div className="cs-compose-input-row">
                <textarea
                  ref={textareaRef}
                  className="cs-textarea"
                  value={draft}
                  onChange={e => {
                    setDraft(e.target.value);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What do you say?"
                  rows={3}
                  maxLength={500}
                  aria-label="Your response"
                  disabled={status === 'loading'}
                />
                <button
                  className="cs-say-btn"
                  onClick={handleSend}
                  disabled={!draft.trim() || status === 'loading' || !selectedIntention}
                  aria-label="Send message"
                  aria-disabled={!draft.trim() || status === 'loading' || !selectedIntention}
                >
                  Send
                </button>
              </div>
              {draft.length > 380 && (
                <p
                  className={`cs-char-count${draft.length > 460 ? ' cs-char-count--warn' : ''}`}
                  aria-live="polite"
                >
                  {500 - draft.length} characters remaining
                </p>
              )}
            </div>
          )
          : stage === 'waiting'
          ? (
            /* ── WAITING ──────────────────────────────── */
            <div
              className="cs-waiting-panel"
              role="status"
              aria-label="Waiting for response"
              aria-live="polite"
            >
              <div className="cs-waiting-intent">
                <span className="cs-waiting-label">Trying to:</span>
                {activeIntentObj && (
                  <span className="cs-intent-chip">
                    <span aria-hidden="true">{activeIntentObj.icon}</span>
                    {activeIntentObj.label}
                  </span>
                )}
              </div>

              {error ? (
                <div
                  className="cs-error-panel"
                  role="alert"
                  aria-live="assertive"
                >
                  <p className="cs-error-text">{error}</p>
                  <button
                    className="cs-retry-btn"
                    onClick={retryTurn}
                    aria-label="Retry sending your message"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p className="cs-waiting-message">
                  She considers what you said
                  <span className="cs-thinking-dots" aria-hidden="true">
                    <span /><span /><span />
                  </span>
                </p>
              )}
            </div>
          )
          : stage === 'impact'
          ? (
            /* ── IMPACT REVEAL ───────────────────────── */
            <ImpactReveal
              assessment={lastAssessment}
              selectedIntent={selectedIntention ?? draftIntentId}
              onContinue={handleContinueFromImpact}
            />
          )
          : null
        }
      </section>

      {/* ── PAUSE OVERLAY ─────────────────────────────── */}
      {isPaused && (
        <PauseOverlay
          showRestartConfirm={showRestartConfirm}
          showTitleConfirm={showTitleConfirm}
          onResume={storeResume}
          onRequestRestart={() => setShowRestartConfirm(true)}
          onConfirmRestart={handleRestart}
          onCancelRestart={() => setShowRestartConfirm(false)}
          onRequestTitle={() => setShowTitleConfirm(true)}
          onConfirmTitle={handleReturnToTitle}
          onCancelTitle={() => setShowTitleConfirm(false)}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReopenTutorial={handleReopenTutorial}
        />
      )}

      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}

      {tutorialOpen && mode === 'playing' && (
        <TutorialOverlay
          step={tutorialStep}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// IMPACT REVEAL
// ═══════════════════════════════════════════════════════
interface ImpactRevealProps {
  assessment: TurnAssessment | null;
  selectedIntent: PlayerIntent | null | undefined;
  onContinue: () => void;
}

function ImpactReveal({ assessment, selectedIntent, onContinue }: ImpactRevealProps) {
  const alignment = assessment?.alignment ?? 'aligned';

  const badgeClass =
    alignment === 'aligned'
      ? 'cs-impact-alignment-badge--aligned'
      : alignment === 'constructive_divergence'
      ? 'cs-impact-alignment-badge--constructive'
      : 'cs-impact-alignment-badge--harmful';

  const badgeLabel =
    alignment === 'aligned'
      ? 'Landed as intended'
      : alignment === 'constructive_divergence'
      ? 'Different, but useful'
      : 'Missed the mark';

  const intentDisplay = selectedIntent
    ? selectedIntent.charAt(0).toUpperCase() + selectedIntent.slice(1)
    : '—';

  const impactDisplay = assessment?.perceivedImpact
    ? assessment.perceivedImpact.charAt(0).toUpperCase() + assessment.perceivedImpact.slice(1)
    : '—';

  return (
    <div
      className="cs-impact-panel"
      data-alignment={alignment}
      aria-label="Intent vs. Impact feedback"
    >
      <div className="cs-impact-comparison" role="region" aria-label="Comparison">
        <div className="cs-impact-col">
          <span className="cs-impact-col-label">Your intention</span>
          <span className="cs-impact-col-value">{intentDisplay}</span>
        </div>
        <div className="cs-impact-divider" aria-hidden="true">
          <svg
            className="cs-impact-divider-icon"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        <div className="cs-impact-col">
          <span className="cs-impact-col-label">How it landed</span>
          <span className="cs-impact-col-value">{impactDisplay}</span>
        </div>
      </div>

      <span className={`cs-impact-alignment-badge ${badgeClass}`}>
        {badgeLabel}
      </span>

      {assessment?.impactReason && (
        <blockquote className="cs-impact-reason">
          {assessment.impactReason}
        </blockquote>
      )}

      <button
        className="cs-impact-continue-btn"
        onClick={onContinue}
        autoFocus
        aria-label="Continue to the next turn"
      >
        Continue
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PAUSE OVERLAY
// ═══════════════════════════════════════════════════════
interface PauseOverlayProps {
  showRestartConfirm: boolean;
  showTitleConfirm:   boolean;
  onResume:           () => void;
  onRequestRestart:   () => void;
  onConfirmRestart:   () => void;
  onCancelRestart:    () => void;
  onRequestTitle:     () => void;
  onConfirmTitle:     () => void;
  onCancelTitle:      () => void;
  onHowToPlay:        () => void;
  onReopenTutorial:   () => void;
}

function PauseOverlay({
  showRestartConfirm,
  showTitleConfirm,
  onResume,
  onRequestRestart,
  onConfirmRestart,
  onCancelRestart,
  onRequestTitle,
  onConfirmTitle,
  onCancelTitle,
  onHowToPlay,
}: PauseOverlayProps) {
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => resumeBtnRef.current?.focus(), 40);
    return () => {
      clearTimeout(t);
      prevFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="cs-pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Game paused"
    >
      <div className="cs-pause-card">
        <h2 className="cs-pause-title">Paused</h2>

        {!showRestartConfirm && !showTitleConfirm ? (
          <>
            <button
              ref={resumeBtnRef as RefObject<HTMLButtonElement>}
              className="cs-pause-btn cs-pause-btn--primary"
              onClick={onResume}
            >
              Resume
            </button>
            <div className="cs-pause-separator" aria-hidden="true" />
            <button className="cs-pause-btn cs-pause-btn--ghost" onClick={onHowToPlay}>
              How to Play
            </button>
            <div className="cs-pause-separator" aria-hidden="true" />
            <button className="cs-pause-btn cs-pause-btn--danger" onClick={onRequestRestart}>
              Restart Conversation
            </button>
            <button className="cs-pause-btn cs-pause-btn--danger" onClick={onRequestTitle}>
              Return to title
            </button>
          </>
        ) : showRestartConfirm ? (
          <ConfirmPanel
            message="Restart the conversation? Your current progress will be lost."
            confirmLabel="Restart"
            onConfirm={onConfirmRestart}
            onCancel={onCancelRestart}
          />
        ) : (
          <ConfirmPanel
            message="Return to the title screen? Your current progress will be lost."
            confirmLabel="Return to title"
            onConfirm={onConfirmTitle}
            onCancel={onCancelTitle}
          />
        )}
      </div>
    </div>
  );
}

function ConfirmPanel({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = setTimeout(() => confirmRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="cs-pause-confirm">
      <p className="cs-pause-confirm-text">{message}</p>
      <div className="cs-pause-confirm-actions">
        <button
          ref={confirmRef as RefObject<HTMLButtonElement>}
          className="cs-pause-btn cs-pause-btn--danger"
          onClick={onConfirm}
          style={{ flex: 1 }}
        >
          {confirmLabel}
        </button>
        <button
          className="cs-pause-btn cs-pause-btn--ghost"
          onClick={onCancel}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TUTORIAL OVERLAY
// ═══════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  {
    title: 'Step 1 — Intention',
    text: 'First, choose what you are trying to accomplish.',
  },
  {
    title: 'Step 2 — Wording',
    text: 'Then write what you would genuinely say. Your exact words matter.',
  },
  {
    title: 'Step 3 — Impact',
    text: 'What you intend and what the other person hears may be different.',
  },
] as const;

interface TutorialOverlayProps {
  step:   0 | 1 | 2;
  onNext: () => void;
  onSkip: () => void;
}

function TutorialOverlay({ step, onNext, onSkip }: TutorialOverlayProps) {
  const current = TUTORIAL_STEPS[step];
  const isLast  = step >= 2;

  return (
    <div
      className="cs-tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial"
    >
      <div className="cs-tutorial-spotlight" aria-hidden="true" onClick={onSkip} />
      <div className="cs-tutorial-tooltip">
        <p className="cs-tutorial-step">{current.title}</p>
        <p className="cs-tutorial-text">{current.text}</p>
        <div className="cs-tutorial-actions">
          <button className="cs-tutorial-skip-btn" onClick={onSkip}>
            Skip tutorial
          </button>
          <button className="cs-tutorial-next-btn" onClick={onNext} autoFocus>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREDITS MODAL
// ═══════════════════════════════════════════════════════
function CreditsModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => closeRef.current?.focus(), 40);
    return () => {
      clearTimeout(t);
      prevFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="cs-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Credits"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cs-modal">
        <h2>Credits</h2>
        <p>
          <strong>UNSAID</strong> is a narrative empathy game about the things
          we leave unsaid and the cost of leaving them.
        </p>
        <p>Built with React, TypeScript, and Google Gemini.</p>
        <p>All artwork and scenario content original.</p>
        <button
          ref={closeRef as RefObject<HTMLButtonElement>}
          className="cs-modal-close"
          onClick={onClose}
          aria-label="Close credits"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HOW TO PLAY MODAL
// ═══════════════════════════════════════════════════════
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => closeRef.current?.focus(), 40);
    return () => {
      clearTimeout(t);
      prevFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="cs-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cs-modal">
        <h2>How to Play</h2>
        <p>
          Each turn, choose an intention — what you are genuinely trying to do —
          then write what you would actually say.
        </p>
        <p>
          After you send your message, you'll see how it landed: whether your
          words carried your intent, or whether something was lost between what
          you meant and what she heard.
        </p>
        <p>There are {SCENARIO.totalTurns} turns. What you say shapes the outcome.</p>
        <ul>
          <li><strong>Understand</strong> — ask questions, listen.</li>
          <li><strong>Acknowledge</strong> — own what you did.</li>
          <li><strong>Explain</strong> — give honest context.</li>
          <li><strong>Repair</strong> — offer a genuine next step.</li>
        </ul>
        <button
          ref={closeRef as RefObject<HTMLButtonElement>}
          className="cs-modal-close"
          onClick={onClose}
          aria-label="Close how to play"
        >
          Close
        </button>
      </div>
    </div>
  );
}
