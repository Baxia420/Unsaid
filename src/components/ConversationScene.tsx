/**
 * UNSAID — ConversationScene.tsx
 * Full-viewport cinematic conversation shell.
 *
 * Screens:            title | prologue | playing | paused | closing | outcome
 * Interaction stages: choose-intent | compose | waiting | impact
 *
 * Core game state lives exclusively in the store.
 * Presentation-local state lives here.
 */

import {
  useCallback,
  useEffect,
  useMemo,
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
  PORTRAIT_CLOSED,
  PORTRAIT_DATA_STATE,
  computeOutcomeSummary,
  getConnectionLabel,
  getPressureLabel,
  getReflection,
  getReviewSummary,
  generateReadTheRoomHint,
  humanizeLabel,
} from './cinematicPresentation';
import type { PlayerIntent, PortraitState, TranscriptEntry, TurnAssessment, TurnNarrativeMeta } from '../game/types';
import './ConversationScene.css';
import { formatConversationTranscript } from './conversationLog';

// ─── Presentation-local types ──────────────────────────
type InteractionStage =
  | 'choose-intent'
  | 'compose'
  | 'waiting'
  | 'impact';

type TUTORIAL_STEP = 0 | 1 | 2;

interface IntentionDef {
  id: PlayerIntent;
  label: string;
  description: string;
  icon: string;
}

const INTENTS: IntentionDef[] = [
  { id: 'understand', label: 'Understand', description: 'Ask and listen', icon: '?' },
  { id: 'acknowledge', label: 'Acknowledge', description: 'Own the harm', icon: '✓' },
  { id: 'explain', label: 'Explain', description: 'Give honest context', icon: '…' },
  { id: 'repair', label: 'Repair', description: 'Offer a next step', icon: '↗' },
];

// ─── Tutorial helpers ──────────────────────────────────
const TUTORIAL_KEY = 'unsaid_tutorial_done';
function writeTutorialDone(value: boolean) {
  try {
    localStorage.setItem(TUTORIAL_KEY, value ? '1' : '');
  } catch {
    /* ignore */
  }
}
function readTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

// Reduced-motion hook
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function ConversationScene() {
  // ── Store bindings ───────────────────────────────────
  const mode = useGameStore((s) => s.mode);
  const status = useGameStore((s) => s.status);
  const error = useGameStore((s) => s.error);
  const transcript = useGameStore((s) => s.transcript);
  const turnIndex = useGameStore((s) => s.turnIndex);
  const selectedIntention = useGameStore((s) => s.selectedIntention);
  const outcome = useGameStore((s) => s.outcome);
  const closingMessage = useGameStore((s) => s.closingMessage);
  const assessments = useGameStore((s) => s.assessments);
  const narrativeHistory = useGameStore((s) => s.narrativeHistory);
  const engagement = useGameStore((s) => s.engagement);
  const tension = useGameStore((s) => s.tension);
  const portraitState = useGameStore((s) => s.portraitState);
  const prologuePart = useGameStore((s) => s.prologuePart);

  const storeStart = useGameStore((s) => s.start);
  const continueFromPrologue = useGameStore((s) => s.continueFromPrologue);
  const nextProloguePart = useGameStore((s) => s.nextProloguePart);
  const prevProloguePart = useGameStore((s) => s.prevProloguePart);
  const skipPrologue = useGameStore((s) => s.skipPrologue);
  const selectIntention = useGameStore((s) => s.selectIntention);
  const setInput = useGameStore((s) => s.setInput);
  const submitTurn = useGameStore((s) => s.submitTurn);
  const retryTurn = useGameStore((s) => s.retryTurn);
  const storePause = useGameStore((s) => s.pause);
  const storeResume = useGameStore((s) => s.resume);
  const continueToOutcome = useGameStore((s) => s.continueToOutcome);
  const storeRestart = useGameStore((s) => s.restart);
  const returnToTitle = useGameStore((s) => s.returnToTitle);

  // ── Presentation state ───────────────────────────────
  const [stage, setStage] = useState<InteractionStage>('choose-intent');
  const [draft, setDraft] = useState('');
  const [draftIntentId, setDraftIntentId] = useState<PlayerIntent | null>(null);
  const [lastAssessment, setLastAssessment] = useState<TurnAssessment | null>(null);
  const prevTurnIndex = useRef(turnIndex);
  const [portraitFailed, setFailedPortrait] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showTitleConfirm, setShowTitleConfirm] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(readTutorialDone);
  const [tutorialStep, setTutorialStep] = useState<TUTORIAL_STEP>(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const submitting = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showConversationLog, setShowConversationLog] = useState(false);
  const reducedMotion = useReducedMotion();

  // ── Derived values ───────────────────────────────────
  const connPct = Math.round(((engagement + 10) / 20) * 100);
  const presPct = Math.round(((tension + 10) / 20) * 100);
  const currentDialogue = [...transcript].reverse().find((entry) => entry.speaker === 'character');
  const portrait = portraitState ?? 'distant';
  const open = ['connected', 'hurt_exposed'].includes(portrait);

  const hintText = useMemo(() => {
    const lastAssessment = assessments.length > 0 ? assessments[assessments.length - 1] : null;
    const context = {
      engagement,
      tension,
      selectedIntention: selectedIntention ?? (lastAssessment ? lastAssessment.selectedIntent : null),
      lastPerceivedImpact: lastAssessment ? lastAssessment.perceivedImpact : null,
      lastAlignment: lastAssessment ? lastAssessment.alignment : null,
      turnIndex,
      totalTurns: SCENARIO.totalTurns,
      recentAssessments: assessments.slice(-3),
    };
    return generateReadTheRoomHint(context);
  }, [engagement, tension, selectedIntention, assessments, turnIndex]);

  // ── Handlers ─────────────────────────────────────────
  function resetConversationPresentation() {
    setStage('choose-intent');
    setDraft('');
    setDraftIntentId(null);
    setLastAssessment(null);
    setHintOpen(false);
    setShowReview(false);
    submitting.current = false;
    prevTurnIndex.current = 0;
  }
  function handleStart() {
    storeStart();
    resetConversationPresentation();
  }
  function handleReturnToTitle() {
    returnToTitle();
    resetConversationPresentation();
  }
  function handleRestart() {
    storeRestart();
    resetConversationPresentation();
  }
  function handleEnterCafe() {
    continueFromPrologue();
    resetConversationPresentation();
  }
  function handleSkipPrologue() {
    skipPrologue();
    resetConversationPresentation();
  }
  function handleSelectIntent(intent: PlayerIntent) {
    selectIntention(intent);
    setDraftIntentId(intent);
    setStage('compose');
  }
  function handleBackToIntents() {
    setStage('choose-intent');
  }
  function handleContinueFromImpact() {
    setLastAssessment(null);
    setDraft('');
    setDraftIntentId(null);
    setStage('choose-intent');
  }
  function handleTutorialSkip() {
    setTutorialOpen(false);
    writeTutorialDone(true);
    setTutorialDone(true);
  }
  function handleReopenTutorial() {
    setTutorialStep(0);
    setTutorialOpen(true);
  }
  function handleTutorialNext() {
    if (tutorialStep >= 2) {
      handleTutorialSkip();
      return;
    }
    setTutorialStep((tutorialStep + 1) as TUTORIAL_STEP);
  }
  function onConfirmRestart() {
    handleRestart();
    setShowRestartConfirm(false);
  }
  function onConfirmTitle() {
    handleReturnToTitle();
    setShowTitleConfirm(false);
  }
  function handleToggleHint() {
    setHintOpen((prev) => !prev);
  }
  function handleDismissHint() {
    setHintOpen(false);
  }

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || status === 'loading' || submitting.current) return;
    if (mode !== 'playing' || !selectedIntention) return;
    submitting.current = true;
    setInput(text);
    setStage('waiting');
    try {
      await submitTurn();
    } finally {
      submitting.current = false;
    }
  }, [draft, mode, selectedIntention, setInput, status, submitTurn]);

  const handleRetry = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await retryTurn();
    } finally {
      submitting.current = false;
    }
  }, [retryTurn]);

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }


  // ── Effects ──────────────────────────────────────────
  useEffect(() => {
    if (prevTurnIndex.current !== turnIndex) {
      prevTurnIndex.current = turnIndex;
      if (status === 'idle' && turnIndex > 0) {
        const prev = assessments[assessments.length - 1];
        if (prev) {
          setLastAssessment(prev);
          setDraftIntentId(prev.selectedIntent);
          setStage('impact');
        }
      }
    }
  }, [turnIndex, status, assessments, selectedIntention]);

  useEffect(() => {
    if (status === 'loading') setStage('waiting');
  }, [status]);

  useEffect(() => {
    if (status === 'error') setStage('waiting');
  }, [status, stage]);

  useEffect(() => {
    if (stage === 'compose') {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    if (tutorialOpen && tutorialStep < 2) {
      const t = setTimeout(() => setTutorialStep((s) => (s + 1) as TUTORIAL_STEP), 1200);
      return () => clearTimeout(t);
    }
  }, [tutorialOpen, tutorialStep]);

  useEffect(() => {
    if (!tutorialDone && mode === 'playing') {
      const t = setTimeout(() => setTutorialOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [mode, tutorialDone]);

  useEffect(() => {
    if (mode === 'prologue') {
      setHintOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    if (turnIndex > 0) {
      setHintOpen(false);
    }
  }, [turnIndex]);


  // Prologue keyboard
  useEffect(() => {
    if (mode !== 'prologue') return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (prologuePart === SCENARIO.prologueParts.length - 1) handleEnterCafe();
        else nextProloguePart();
      } else if (e.key === 'Escape') {
        if (prologuePart === 0) {
          returnToTitle();
        } else {
          prevProloguePart();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, prologuePart, nextProloguePart, prevProloguePart, returnToTitle]);

  // Global keyboard (Escape for pause)
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

  // ─── TITLE SCREEN ─────────────────────────────────────
  if (mode === 'title') {
    return (
      <div className="cs-root cs-title-screen" data-app-mode="title">
        <div
          className="cs-title-bg"
          style={{
            backgroundImage: `url(${CAFE_BACKGROUND})`,
          }}
          aria-hidden="true"
        />
        <div className="cs-title-overlay" aria-hidden="true" />
        <div className="cs-title-content" role="main">
          <h1 className="cs-title-heading">{SCENARIO.title}</h1>
          <p className="cs-title-subtitle">{SCENARIO.description}</p>
          <button
            className="cs-title-btn-primary"
            onClick={handleStart}
            autoFocus
            aria-label="Start — Begin the game"
          >
            Start
          </button>
          <button
            className="cs-title-btn-ghost"
            onClick={() => setShowHowToPlay(true)}
            aria-label="Continue — How to play"
          >
            How to Play
          </button>
          <button
            className="cs-title-btn-ghost"
            onClick={() => setShowCredits(true)}
            aria-label="Continue — View credits"
          >
            Credits
          </button>
        </div>
        {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
        {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      </div>
    );
  }

  // ─── PROLOGUE SCREEN ──────────────────────────────────
  if (mode === 'prologue') {
    const part = SCENARIO.prologueParts[prologuePart];
    const isLastPart = prologuePart === SCENARIO.prologueParts.length - 1;
    return (
      <div className="cs-root cs-prologue-screen" data-app-mode="prologue">
        <div
          className={`cs-prologue-bg cs-prologue-bg--part-${prologuePart} ${reducedMotion ? 'cs-prologue-bg--reduced' : ''}`}
          aria-hidden="true"
          style={{ backgroundImage: `url(${CAFE_BACKGROUND})` }}
        />
        <div className={`cs-prologue-overlay ${isLastPart ? 'cs-prologue-overlay--part-2' : ''}`} aria-hidden="true" />
        <div className="cs-prologue-content" role="main" aria-label="Story prologue">
          {/* SCENARIO.prologue reference preserved for backward compatibility */}
          <div className="cs-prologue-part-indicator">
            <span className="cs-prologue-part-number">Part {prologuePart + 1}</span>
            <span className="cs-prologue-part-title">{part.title}</span>
          </div>
          <div className="cs-prologue-paragraphs">
            {part.paragraphs.map((para, i) => (
              <p key={i} className="cs-prologue-para">{para}</p>
            ))}
            {part.highlightQuote && (
              <blockquote className={`cs-prologue-quote ${reducedMotion ? '' : 'cs-prologue-quote--animated'}`}>
                {part.highlightQuote}
              </blockquote>
            )}
            {part.postQuoteParagraphs?.map((para, i) => (
              <p key={`post-${i}`} className="cs-prologue-para">{para}</p>
            ))}
          </div>
          <div className="cs-prologue-actions">
            {prologuePart > 0 && (
              <button className="cs-title-btn-ghost" onClick={() => prevProloguePart()}>
                Back
              </button>
            )}
            <button className="cs-title-btn-ghost" onClick={handleSkipPrologue}>
              Skip Prologue
            </button>
            {isLastPart ? (
              <button
                className="cs-title-btn-primary"
                onClick={handleEnterCafe}
                autoFocus
                aria-label="Enter the Café — Begin the conversation"
              >
                Enter the Café
              </button>
            ) : (
              <button
                className="cs-title-btn-primary"
                onClick={() => nextProloguePart()}
                autoFocus
                aria-label="Continue — Next part"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── OUTCOME SCREEN ───────────────────────────────────
  if (mode === 'outcome') {
    const out = outcome ?? SCENARIO.outcomes['even'];
    const reflection = getReflection(assessments, engagement, tension);
    const review = getReviewSummary(assessments);
    const connLabel = getConnectionLabel(engagement);
    const presLabel = getPressureLabel(tension);
    const summary = computeOutcomeSummary(assessments);
    return (
      <div className="cs-root cs-outcome-mode" data-app-mode="outcome">
        <div
          className="cs-outcome-bg"
          style={{ backgroundImage: `url(${CAFE_BACKGROUND})` }}
          aria-hidden="true"
        />
        <div className="cs-outcome-bg-dim" aria-hidden="true" />
        <div className="cs-outcome-portrait-wrap">
          {!portraitFailed && (
            <img
              className="cs-outcome-portrait"
              src={PORTRAIT_OPEN[portrait as PortraitState]}
              alt="Friend portrait"
              onLoad={() => setFailedPortrait(false)}
              onError={() => setFailedPortrait(true)}
            />
          )}
          <div className={`cs-portrait-silhouette ${!portraitFailed ? 'cs-portrait-silhouette--hidden' : ''}`} aria-hidden="true" />
        </div>
        <div className="cs-outcome-card" role="main" aria-label="Game outcome">
          <p className="cs-outcome-eyebrow">End of Conversation</p>
          <h2 className="cs-outcome-title">{out.title}</h2>
          <p className="cs-outcome-description">{out.description}</p>

          <div className="cs-outcome-section">
            <h3 className="cs-outcome-section-title">Where things ended</h3>
            <div className="cs-outcome-stat-row">
              <span className="cs-outcome-stat-label">Connection</span>
              <span className="cs-outcome-stat-value">{connLabel}</span>
            </div>
            <div className="cs-outcome-stat-row">
              <span className="cs-outcome-stat-label">Pressure</span>
              <span className="cs-outcome-stat-value">{presLabel}</span>
            </div>
          </div>

          <div className="cs-outcome-section">
            <h3 className="cs-outcome-section-title">Reflection</h3>
            <p className="cs-outcome-reflection">{reflection}</p>
          </div>

          <div className="cs-outcome-review">
            <button
              className="cs-outcome-review-toggle"
              onClick={() => setShowReview((prev) => !prev)}
              aria-expanded={showReview}
            >
              Review Conversation
            </button>
            {showReview && (
              <div className="cs-outcome-review-panel">
                {summary && <p className="cs-outcome-summary">{summary}</p>}
                {review.mostUsedIntention && (
                  <p className="cs-review-line">
                    Most-used intention: <strong>{humanizeLabel(review.mostUsedIntention)}</strong>
                  </p>
                )}
                {review.mostCommonImpact && (
                  <p className="cs-review-line">
                    Most common impact: <strong>{humanizeLabel(review.mostCommonImpact)}</strong>
                  </p>
                )}
                <p className="cs-review-line">Aligned moments: {review.alignedMoments}</p>
                <p className="cs-review-line">Constructive divergences: {review.constructiveDivergences}</p>
                <p className="cs-review-line">Harmful divergences: {review.harmfulDivergences}</p>
              </div>
            )}
          </div>

          <div className="cs-outcome-actions">
            <button
              className="cs-outcome-btn cs-outcome-btn--primary"
              onClick={handleRestart}
              aria-label="Replay — Play again from the start"
            >
              Play Again
            </button>
            <button
              className="cs-outcome-btn"
              onClick={handleReturnToTitle}
              aria-label="Return to title screen"
            >
              Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // GAMEPLAY / CLOSING / PAUSED
  // ═══════════════════════════════════════════════════════
  const isPaused = mode === 'paused';
  const isClosing = mode === 'closing';

  return (
    <div className="cs-root" data-app-mode={isClosing ? 'closing' : 'playing'}>
      {/* ── Background ───────────────────────────────── */}
      <div
        className="cs-background"
        style={{ backgroundImage: `url(${CAFE_BACKGROUND})` }}
        aria-hidden="true"
      />
      <div className="cs-atmosphere-layer" aria-hidden="true" />

      {/* ── Scene ────────────────────────────────────── */}
      <section className="cs-stage" aria-label="Conversation scene">
        {/* HUD */}
        <div className="cs-hud" aria-label="Game status">
          <div className="cs-hud-stat" aria-label="Connection state">
            <span className="cs-hud-label">Connection</span>
            <div className="cs-hud-bar">
              <div
                className="cs-hud-bar-track"
                role="meter"
                aria-label={`Connection: ${connPct}%`}
                aria-valuenow={connPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="cs-hud-bar-fill cs-hud-bar-fill--conn"
                  style={{ width: `${connPct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="cs-hud-turn" aria-label="Turn count">
            Turn {turnIndex} / {SCENARIO.totalTurns}
          </div>
          <div className="cs-hud-stat" aria-label="Pressure state">
            <span className="cs-hud-label">Pressure</span>
            <div className="cs-hud-bar">
              <div
                className="cs-hud-bar-track cs-hud-bar-track--pressure"
                role="meter"
                aria-label={`Pressure: ${presPct}%`}
                aria-valuenow={presPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="cs-hud-bar-fill cs-hud-bar-fill--pressure"
                  style={{ width: `${presPct}%` }}
                />
              </div>
            </div>
          </div>
          <button
            className="cs-hud-pause-btn"
            onClick={() => setShowConversationLog(true)}
            aria-label="Open Conversation Log"
          >
            Conversation Log
          </button>
          <button
            className="cs-hud-pause-btn"
            onClick={storePause}
            aria-label="Pause the game"
            title="Pause (Esc)"
          >
            Pause
          </button>
        </div>

        {/* Portrait */}
        <div className="cs-portrait">
          <div className="cs-portrait-frame">
            {!portraitFailed && (
              <img
                className="cs-portrait-img"
                key={`${portrait}-${open ? 'open' : 'closed'}`}
                src={open ? PORTRAIT_OPEN[portrait] : PORTRAIT_CLOSED[portrait]}
                alt="Friend portrait"
                data-portrait={PORTRAIT_DATA_STATE[portrait]}
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
            )}
          </div>
          <div className={`cs-portrait-silhouette ${!portraitFailed ? 'cs-portrait-silhouette--hidden' : ''}`} />
        </div>

        {/* Table foreground */}
        <div className="cs-table-foreground" />

        {currentDialogue && (
          <div className="cs-dialogue-card" role="status" aria-live="polite" aria-label="Current friend dialogue">
            <div className="cs-dialogue-speaker" aria-hidden="true">Friend</div>
            <div className="cs-dialogue-text">{currentDialogue.text}</div>
          </div>
        )}

        {/* Closing panel */}
        {isClosing && closingMessage && (
          <div className="cs-dock">
            <div className="cs-closing-panel" role="status" aria-label="Final closing">
              <div className="cs-closing-eyebrow">Final closing</div>
              <div className="cs-closing-message">{closingMessage}</div>
              <button
                className="cs-closing-continue-btn"
                onClick={continueToOutcome}
                autoFocus
                aria-label="Continue — View outcome"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Interaction dock */}
        {!isClosing && <div className="cs-dock">
          {/* Intent selection */}
          {stage === 'choose-intent' && (
            <div className="cs-intent-panel" role="region" aria-label="choose-intent">
              <div className="cs-intent-header">
                <p className="cs-intent-legend" id="intent-legend">What are you trying to do?</p>
                <button
                  className="cs-read-the-room-btn"
                  onClick={handleToggleHint}
                  aria-label="Read the room"
                  aria-expanded={hintOpen}
                >
                  Read the room
                </button>
              </div>
              {hintOpen && (
                <div className="cs-hint-panel" role="status" aria-label="Read the room hint">
                  <p className="cs-hint-text">{hintText}</p>
                  <button className="cs-hint-dismiss" onClick={handleDismissHint} aria-label="Dismiss hint">
                    Dismiss
                  </button>
                </div>
              )}
              <div className="cs-intent-grid" role="group" aria-labelledby="intent-legend">
                {INTENTS.map((intent) => (
                  <button
                    key={intent.id}
                    className="cs-intent-btn"
                    onClick={() => handleSelectIntent(intent.id)}
                    aria-label={`${intent.label} — ${intent.description}`}
                    title={intent.description}
                  >
                    <span className="cs-intent-icon" aria-hidden="true">
                      {intent.icon}
                    </span>
                    <span className="cs-intent-label">{intent.label}</span>
                    <span className="cs-intent-desc">{intent.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compose */}
          {stage === 'compose' && (
            <div className="cs-compose-panel" role="region" aria-label="compose">
              <div className="cs-compose-header">
                <span className="cs-intent-chip cs-intent-chip--active">
                  {INTENTS.find((i) => i.id === selectedIntention)?.label}
                </span>
                <button
                  className="cs-compose-back-btn"
                  onClick={handleBackToIntents}
                  aria-label="Change intention"
                >
                  Change intention
                </button>
              </div>
              <textarea
                ref={textareaRef}
                className="cs-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Write what you would say..."
                maxLength={SCENARIO.maxPlayerTextLength}
                rows={4}
                aria-label="Your message"
              />
              <div className="cs-compose-input-row">
                <span className="cs-char-count">
                  {draft.length} / {SCENARIO.maxPlayerTextLength}
                </span>
                <button
                  className="cs-say-btn"
                  onClick={handleSubmit}
                  disabled={!draft.trim()}
                  aria-disabled={!draft.trim()}
                  aria-label="Send message"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Waiting */}
          {stage === 'waiting' && (
            <div className="cs-waiting-panel" role="status" aria-label="waiting">
              <p className="cs-waiting-message">
                She considers what you said
                <span className="cs-thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              </p>
              {error && (
                <div className="cs-error-panel" role="alert">
                  <p className="cs-error-text">{error}</p>
                  <button
                    className="cs-retry-btn"
                    onClick={handleRetry}
                    aria-label="Retry"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Impact */}
          {stage === 'impact' && lastAssessment && (
            <div className="cs-impact-panel" role="region" aria-label="Impact reveal">
              <ImpactReveal
                selectedIntent={selectedIntention ?? draftIntentId}
                assessment={lastAssessment}
              />
              <button
                className="cs-impact-continue-btn"
                onClick={handleContinueFromImpact}
                autoFocus
                aria-label="Continue to next turn"
              >
                Continue
              </button>
            </div>
          )}
        </div>}
      </section>

      {/* Tutorial overlay */}
      {mode === 'playing' && tutorialOpen && (
        <TutorialOverlay
          step={tutorialStep}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
        />
      )}

      {/* Pause overlay */}
      {isPaused && (
        <PauseOverlay
          showRestartConfirm={showRestartConfirm}
          showTitleConfirm={showTitleConfirm}
          onResume={storeResume}
          onRequestRestart={() => setShowRestartConfirm(true)}
          onConfirmRestart={onConfirmRestart}
          onCancelRestart={() => setShowRestartConfirm(false)}
          onRequestTitle={() => setShowTitleConfirm(true)}
          onConfirmTitle={onConfirmTitle}
          onCancelTitle={() => setShowTitleConfirm(false)}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReopenTutorial={handleReopenTutorial}
        />
      )}

      {/* How to play modal */}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

      {showConversationLog && (
        <ConversationLog
          transcript={transcript}
          assessments={assessments}
          narrativeHistory={narrativeHistory}
          onClose={() => setShowConversationLog(false)}
        />
      )}

      {/* Credits modal */}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// IMPACT REVEAL
// ═══════════════════════════════════════════════════════
function ConversationLog({ transcript, assessments, narrativeHistory, onClose }: { transcript: TranscriptEntry[]; assessments: TurnAssessment[]; narrativeHistory: TurnNarrativeMeta[]; onClose: () => void; }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const readable = formatConversationTranscript(transcript);
  const debug = JSON.stringify({ transcript, assessments, narrativeHistory }, null, 2);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  async function copy(text: string, label: string) { await navigator.clipboard.writeText(text); setCopyStatus(`${label} copied`); }
  return (
    <div className="cs-modal-backdrop cs-log-backdrop" role="dialog" aria-modal="true" aria-label="Conversation Log">
      <section className="cs-conversation-log">
        <header className="cs-log-header"><div><p className="cs-closing-eyebrow">Current conversation</p><h2>Conversation Log</h2></div><button ref={closeRef} className="cs-modal-close" onClick={onClose}>Close</button></header>
        <div className="cs-log-transcript" role="log" aria-label="Complete chronological conversation">
          {transcript.map((entry, index) => <article className="cs-log-entry" key={`${entry.speaker}-${index}`}><span>{entry.speaker === 'character' ? 'Friend' : 'You'}</span><p>{entry.text}</p></article>)}
        </div>
        <button className="cs-outcome-review-toggle" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails}>Turn details</button>
        {showDetails && <div className="cs-log-details">{assessments.map((assessment, index) => { const narrative = narrativeHistory[index]; return <p key={index}>Turn {index + 1}: {humanizeLabel(assessment.selectedIntent)} → {humanizeLabel(assessment.perceivedImpact)} ({humanizeLabel(assessment.alignment)}){narrative ? ` · ${humanizeLabel(narrative.sceneMove)} · ${narrative.providerSource ?? 'local'} ${narrative.latencyMs ?? 0}ms` : ''}</p>; })}</div>}
        <footer className="cs-log-actions"><button className="cs-outcome-btn cs-outcome-btn--primary" onClick={() => void copy(readable, 'Transcript')}>Copy Transcript</button><button className="cs-outcome-btn" onClick={() => void copy(debug, 'Debug data')}>Copy Debug Data</button><span role="status" aria-live="polite">{copyStatus}</span></footer>
      </section>
    </div>
  );
}

function ImpactReveal({
  selectedIntent,
  assessment,
}: {
  selectedIntent: string | null;
  assessment: TurnAssessment;
}) {
  const badgeClass = assessment.alignment === 'aligned'
    ? 'cs-impact-alignment-badge--aligned'
    : assessment.alignment === 'constructive_divergence'
      ? 'cs-impact-alignment-badge--constructive'
      : 'cs-impact-alignment-badge--harmful';
  const badgeLabel = assessment.alignment === 'aligned'
    ? 'Landed as intended'
    : assessment.alignment === 'constructive_divergence'
      ? 'Different, but useful'
      : 'Missed the mark';

  return (
    <div className="cs-impact-reveal" data-alignment={assessment.alignment}>
      <div className="cs-impact-comparison">
        <div className="cs-impact-col">
          <div className="cs-impact-col-label">Your intention</div>
          <div className="cs-impact-col-value">{selectedIntent ? humanizeLabel(selectedIntent) : '—'}</div>
        </div>
        <div className="cs-impact-divider" aria-hidden="true">→</div>
        <div className="cs-impact-col">
          <div className="cs-impact-col-label">How it landed</div>
          <div className="cs-impact-col-value">{humanizeLabel(assessment.perceivedImpact)}</div>
        </div>
      </div>
      <span className={`cs-impact-alignment-badge ${badgeClass}`}>{badgeLabel}</span>
      <blockquote className="cs-impact-reason">{assessment.impactReason}</blockquote>
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
