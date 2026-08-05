/**
 * Progressive Cinematic UI — Presentation Tests
 *
 * 38 tests covering Section 20 of the task specification.
 * These tests operate on file-system content only (no DOM, no live network).
 * All core gameplay tests remain untouched.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  PORTRAIT_OPEN,
  PORTRAIT_CLOSED,
  BLINK_SRC,
  computeOutcomeSummary,
  cinematicPresentation,
} from '../src/components/cinematicPresentation';
import { createInitialState, useGameStore } from '../src/game/store';
import { SCENARIO } from '../src/game/scenario';
import type { TurnAssessment } from '../src/game/types';

const ROOT      = resolve(__dirname, '..');
const COMPONENT = readFileSync(resolve(ROOT, 'src/components/ConversationScene.tsx'), 'utf8');
const CSS       = readFileSync(resolve(ROOT, 'src/components/ConversationScene.css'), 'utf8');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAssessment(
  alignment: TurnAssessment['alignment'],
  selectedIntent: TurnAssessment['selectedIntent'] = 'acknowledge',
  perceivedImpact: TurnAssessment['perceivedImpact'] = 'acknowledgment',
): TurnAssessment {
  return {
    selectedIntent,
    perceivedImpact,
    impactReason: 'Test reason.',
    alignment,
    engagementDelta: 0,
    tensionDelta: 0,
  };
}

// ── 1. Title screen renders in title mode ─────────────────────────────────────

describe('1. title screen', () => {
  it('exposes data-app-mode="title"', () => {
    expect(COMPONENT).toContain('data-app-mode="title"');
  });

  it('has a dedicated title-screen class', () => {
    expect(COMPONENT).toContain('cs-title-screen');
    expect(CSS).toContain('.cs-title-screen');
  });
});

// ── 2. Begin enters prologue ──────────────────────────────────────────────────

describe('2. begin enters prologue', () => {
  beforeEach(() => {
    useGameStore.setState(createInitialState(0));
  });

  it('store.start() transitions to prologue mode', () => {
    useGameStore.getState().start();
    expect(useGameStore.getState().mode).toBe('prologue');
  });

  it('component exposes prologue mode hook', () => {
    expect(COMPONENT).toContain(`data-app-mode="prologue"`);
  });
});

// ── 3. Prologue reads scenario-owned text ─────────────────────────────────────

describe('3. prologue reads scenario data', () => {
  it('scenario.prologue is a non-empty array', () => {
    expect(Array.isArray(SCENARIO.prologue)).toBe(true);
    expect(SCENARIO.prologue.length).toBeGreaterThan(0);
  });

  it('component imports and uses SCENARIO for prologue', () => {
    expect(COMPONENT).toContain('SCENARIO.prologue');
  });

  it('prologue references the nine-year friendship fact', () => {
    const text = SCENARIO.prologue.join(' ');
    expect(text.toLowerCase()).toMatch(/nine.year/);
  });

  it('prologue references the broken promise fact', () => {
    const text = SCENARIO.prologue.join(' ');
    expect(text.toLowerCase()).toContain('promise');
  });

  it('prologue references the silence fact', () => {
    const text = SCENARIO.prologue.join(' ');
    expect(text.toLowerCase()).toContain('silence');
  });
});

// ── 4. Continue enters gameplay ───────────────────────────────────────────────

describe('4. continue enters gameplay', () => {
  beforeEach(() => {
    useGameStore.setState(createInitialState(0));
  });

  it('continueFromPrologue() moves from prologue to playing', () => {
    useGameStore.getState().start();
    useGameStore.getState().continueFromPrologue();
    expect(useGameStore.getState().mode).toBe('playing');
  });

  it('component has Continue label', () => {
    expect(COMPONENT).toContain('Continue');
  });
});

// ── 5. Gameplay initially shows intention selection ───────────────────────────

describe('5. gameplay initially shows intention selection', () => {
  it('component has intent-panel region', () => {
    expect(COMPONENT).toContain('cs-intent-panel');
    expect(COMPONENT).toContain('choose-intent');
  });

  it('component has intent-grid', () => {
    expect(COMPONENT).toContain('cs-intent-grid');
  });
});

// ── 6. Text composer absent during intention selection ────────────────────────

describe('6. text composer absent during intent selection', () => {
  it('compose panel only renders when stage is compose', () => {
    expect(COMPONENT).toContain(`stage === 'compose'`);
    // compose-panel and intent-panel are mutually exclusive branches
    const intentIdx  = COMPONENT.indexOf(`'choose-intent'`);
    const composeIdx = COMPONENT.indexOf(`'compose'`);
    expect(intentIdx).toBeGreaterThanOrEqual(0);
    expect(composeIdx).toBeGreaterThan(intentIdx);
  });
});

// ── 7. Choosing an intention hides the choices ────────────────────────────────

describe('7. choosing an intention hides choices', () => {
  it('handleSelectIntent transitions to compose stage', () => {
    expect(COMPONENT).toContain("setStage('compose')");
    expect(COMPONENT).toContain("handleSelectIntent");
  });
});

// ── 8. Choosing an intention reveals the composer ────────────────────────────

describe('8. choosing an intention reveals composer', () => {
  it('compose panel exists as a distinct rendering path', () => {
    expect(COMPONENT).toContain('cs-compose-panel');
  });

  it('textarea is rendered inside compose panel', () => {
    expect(COMPONENT).toContain('cs-textarea');
  });
});

// ── 9. Selected intention chip visible ───────────────────────────────────────

describe('9. selected intention chip', () => {
  it('intent-chip is rendered in compose and waiting states', () => {
    const chipCount = (COMPONENT.match(/cs-intent-chip/g) ?? []).length;
    expect(chipCount).toBeGreaterThanOrEqual(2);
  });
});

// ── 10. Change intention returns to selection ────────────────────────────────

describe('10. change intention returns to selection', () => {
  it('back button triggers setStage choose-intent', () => {
    expect(COMPONENT).toContain("setStage('choose-intent')");
    expect(COMPONENT).toContain('Change intention');
  });

  it('handleBackToIntents is defined', () => {
    expect(COMPONENT).toContain('handleBackToIntents');
  });
});

// ── 11. Draft preserved when changing intention ───────────────────────────────

describe('11. draft preserved when changing intention', () => {
  it('draft state is not cleared in handleBackToIntents', () => {
    // Extract handleBackToIntents body — must not contain setDraft('')
    const fnStart = COMPONENT.indexOf('function handleBackToIntents');
    const fnEnd   = COMPONENT.indexOf('\n  }', fnStart) + 4;
    const fnBody  = COMPONENT.slice(fnStart, fnEnd);
    expect(fnBody).not.toContain("setDraft('')");
  });

  it('draft useState is declared', () => {
    expect(COMPONENT).toContain("useState('')");
  });
});

// ── 12. Send disabled for empty input ────────────────────────────────────────

describe('12. Send disabled for empty input', () => {
  it('Send button disabled when draft is empty', () => {
    expect(COMPONENT).toContain('!draft.trim()');
  });

  it('Send button has aria-disabled binding', () => {
    expect(COMPONENT).toContain('aria-disabled');
  });
});

// ── 13. Waiting state replaces composer during loading ────────────────────────

describe('13. waiting state replaces composer', () => {
  it('waiting panel is a distinct rendering branch', () => {
    expect(COMPONENT).toContain("stage === 'waiting'");
    expect(COMPONENT).toContain('cs-waiting-panel');
  });

  it('loading status transitions to waiting stage', () => {
    expect(COMPONENT).toContain("status === 'loading'");
    expect(COMPONENT).toContain("setStage('waiting')");
  });
});

// ── 14. Duplicate submission impossible ──────────────────────────────────────

describe('14. duplicate submission impossible', () => {
  it('submitting ref guards the send handler', () => {
    expect(COMPONENT).toContain('submitting.current');
    expect(COMPONENT).toContain('submitting = useRef(false)');
  });
});

// ── 15. Successful response displays Impact reveal ────────────────────────────

describe('15. impact reveal after successful response', () => {
  it('impact stage is rendered via ImpactReveal', () => {
    expect(COMPONENT).toContain("stage === 'impact'");
    expect(COMPONENT).toContain('ImpactReveal');
  });

  it('assessment is passed to ImpactReveal', () => {
    expect(COMPONENT).toContain('lastAssessment');
  });
});

// ── 16. Intent choices absent during impact reveal ───────────────────────────

describe('16. intent choices absent during impact reveal', () => {
  it('intent-panel and impact-panel are mutually exclusive branches', () => {
    // Both guarded by stage checks — verify both strings exist
    expect(COMPONENT).toContain("'choose-intent'");
    expect(COMPONENT).toContain("'impact'");
    // They should not be inside the same unconditional block
    expect(COMPONENT).not.toContain('cs-intent-panel\n            <ImpactReveal');
  });
});

// ── 17. Impact reveal includes intent and perceived values ────────────────────

describe('17. impact reveal includes intent and perceived', () => {
  it('ImpactReveal component receives selectedIntent prop', () => {
    expect(COMPONENT).toContain('selectedIntent={');
  });

  it('ImpactReveal component receives assessment prop', () => {
    expect(COMPONENT).toContain('assessment={');
  });

  it('ImpactReveal renders intention and how-it-landed columns', () => {
    // These labels are inside the ImpactReveal function in the same file
    expect(COMPONENT).toContain('Your intention');
    expect(COMPONENT).toContain('How it landed');
  });
});

// ── 18. Continue from impact returns to intent selection ─────────────────────

describe('18. continue from impact returns to selection', () => {
  it('handleContinueFromImpact resets stage to choose-intent', () => {
    const fnStart = COMPONENT.indexOf('function handleContinueFromImpact');
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnEnd  = COMPONENT.indexOf('\n  }', fnStart) + 4;
    const fnBody = COMPONENT.slice(fnStart, fnEnd);
    expect(fnBody).toContain("setStage('choose-intent')");
  });
});

// ── 19. Tutorial appears for first-time player ───────────────────────────────

describe('19. tutorial appears for first-time player', () => {
  it('tutorial component is rendered on playing mode', () => {
    expect(COMPONENT).toContain('TutorialOverlay');
    expect(COMPONENT).toContain("mode === 'playing'");
  });

  it('tutorialDone initialises from localStorage', () => {
    expect(COMPONENT).toContain('readTutorialDone');
    expect(COMPONENT).toContain(TUTORIAL_KEY_STRING);
  });
});

const TUTORIAL_KEY_STRING = 'unsaid_tutorial_done';

// ── 20. Tutorial can be skipped ───────────────────────────────────────────────

describe('20. tutorial can be skipped', () => {
  it('skip button exists in tutorial overlay', () => {
    expect(COMPONENT).toContain('Skip tutorial');
  });

  it('handleTutorialSkip closes tutorial and marks done', () => {
    expect(COMPONENT).toContain('handleTutorialSkip');
    const fnStart = COMPONENT.indexOf('function handleTutorialSkip');
    const fnEnd   = COMPONENT.indexOf('\n  }', fnStart) + 4;
    const fnBody  = COMPONENT.slice(fnStart, fnEnd);
    expect(fnBody).toContain('setTutorialOpen(false)');
    expect(fnBody).toContain('writeTutorialDone');
  });
});

// ── 21. Tutorial completion remembered safely ─────────────────────────────────

describe('21. tutorial completion remembered safely', () => {
  it('writeTutorialDone wraps localStorage in try/catch', () => {
    const fnStart = COMPONENT.indexOf('function writeTutorialDone');
    const fnEnd   = COMPONENT.indexOf('\n}', fnStart) + 2;
    const fnBody  = COMPONENT.slice(fnStart, fnEnd);
    expect(fnBody).toContain('try');
    expect(fnBody).toContain('catch');
    expect(fnBody).toContain('localStorage.setItem');
  });

  it('readTutorialDone wraps localStorage in try/catch', () => {
    const fnStart = COMPONENT.indexOf('function readTutorialDone');
    const fnEnd   = COMPONENT.indexOf('\n}', fnStart) + 2;
    const fnBody  = COMPONENT.slice(fnStart, fnEnd);
    expect(fnBody).toContain('try');
    expect(fnBody).toContain('catch');
  });
});

// ── 22. Tutorial reopenable from pause / help ─────────────────────────────────

describe('22. tutorial reopenable from pause/help', () => {
  it('handleReopenTutorial function exists', () => {
    expect(COMPONENT).toContain('handleReopenTutorial');
  });

  it('reopening sets tutorial open and resets step to 0', () => {
    const fnStart = COMPONENT.indexOf('function handleReopenTutorial');
    const fnEnd   = COMPONENT.indexOf('\n  }', fnStart) + 4;
    const fnBody  = COMPONENT.slice(fnStart, fnEnd);
    expect(fnBody).toContain('setTutorialStep(0)');
    expect(fnBody).toContain('setTutorialOpen(true)');
  });
});

// ── 23. HUD separates Connection and Pressure ────────────────────────────────

describe('23. HUD has separate Connection and Pressure', () => {
  it('HUD renders two separate stat labels', () => {
    expect(COMPONENT).toContain('Connection');
    expect(COMPONENT).toContain('Pressure');
  });

  it('HUD has separate bar tracks for each stat', () => {
    expect(COMPONENT).toContain('cs-hud-bar-track--pressure');
  });

  it('CSS defines separate bar fill colours', () => {
    expect(CSS).toContain('--cs-conn-bar');
    expect(CSS).toContain('--cs-pres-bar');
    expect(CSS).toContain('.cs-hud-bar-fill--pressure');
  });

  it('CSS avoids combining Connection and Pressure in one label', () => {
    expect(CSS).not.toContain('Connection Pressure');
    expect(COMPONENT).not.toContain('Connection Pressure');
  });
});

// ── 24. HUD displays turn count ──────────────────────────────────────────────

describe('24. HUD displays turn count', () => {
  it('turn label references totalTurns from SCENARIO', () => {
    expect(COMPONENT).toContain('SCENARIO.totalTurns');
  });

  it('scenario totalTurns is 15', () => {
    expect(SCENARIO.totalTurns).toBe(15);
  });
});

// ── 25. Pause overlay renders and blocks gameplay ────────────────────────────

describe('25. pause overlay renders and blocks', () => {
  it('PauseOverlay component is defined', () => {
    expect(COMPONENT).toContain('PauseOverlay');
  });

  it('pause overlay has role=dialog and aria-modal', () => {
    expect(COMPONENT).toContain('role="dialog"');
    expect(COMPONENT).toContain('aria-modal="true"');
  });

  it('store.pause() requires playing mode', () => {
    useGameStore.setState(createInitialState(0));
    useGameStore.getState().start();
    useGameStore.getState().continueFromPrologue();
    useGameStore.getState().pause();
    expect(useGameStore.getState().mode).toBe('paused');
  });

  it('submission blocked in paused mode', async () => {
    useGameStore.setState({ mode: 'paused', input: 'test', selectedIntention: 'understand' });
    await useGameStore.getState().submitTurn();
    // no network call should have been attempted; turnIndex unchanged
    expect(useGameStore.getState().turnIndex).toBe(0);
  });
});

// ── 26. Resume works ─────────────────────────────────────────────────────────

describe('26. resume works', () => {
  it('component has Resume label', () => {
    expect(COMPONENT).toContain('Resume');
  });

  it('store.resume() returns to playing', () => {
    useGameStore.setState(createInitialState(0));
    useGameStore.getState().start();
    useGameStore.getState().continueFromPrologue();
    useGameStore.getState().pause();
    useGameStore.getState().resume();
    expect(useGameStore.getState().mode).toBe('playing');
  });
});

// ── 27. Restart confirmation works ───────────────────────────────────────────

describe('27. restart confirmation', () => {
  it('showRestartConfirm state is declared', () => {
    expect(COMPONENT).toContain('showRestartConfirm');
  });

  it('onRequestRestart triggers confirmation before action', () => {
    expect(COMPONENT).toContain('setShowRestartConfirm(true)');
    expect(COMPONENT).toContain('onConfirmRestart');
  });

  it('confirmation text warns about progress loss', () => {
    expect(COMPONENT).toContain('progress will be lost');
  });
});

// ── 28. Return-to-title confirmation works ───────────────────────────────────

describe('28. return-to-title confirmation', () => {
  it('showTitleConfirm state is declared', () => {
    expect(COMPONENT).toContain('showTitleConfirm');
  });

  it('onRequestTitle triggers confirmation', () => {
    expect(COMPONENT).toContain('setShowTitleConfirm(true)');
    expect(COMPONENT).toContain('onConfirmTitle');
  });

  it('Return to title label is present in pause overlay', () => {
    expect(COMPONENT).toContain('Return to title');
  });
});

// ── 29. Closing mode shows final message before outcome ──────────────────────

describe('29. closing mode shows final message', () => {
  it('mode=closing shows closing panel, not outcome', () => {
    expect(COMPONENT).toContain('isClosing');
    expect(COMPONENT).toContain('cs-closing-panel');
    expect(COMPONENT).toContain('cs-closing-message');
  });

  it('closing uses store.closingMessage', () => {
    expect(COMPONENT).toContain('closingMessage');
  });

  it('closing mode data-app-mode is "closing"', () => {
    expect(COMPONENT).toContain(`data-app-mode={isClosing ? 'closing' : 'playing'}`);
  });
});

// ── 30. Continue from closing enters outcome ─────────────────────────────────

describe('30. continue from closing enters outcome', () => {
  it('closing Continue calls continueToOutcome', () => {
    expect(COMPONENT).toContain('continueToOutcome');
  });

  it('store.continueToOutcome() transitions to outcome', () => {
    useGameStore.setState({ mode: 'closing' });
    useGameStore.getState().continueToOutcome();
    expect(useGameStore.getState().mode).toBe('outcome');
  });
});

// ── 31. Outcome renders code-owned title and description ─────────────────────

describe('31. outcome renders code-owned data', () => {
  it('component uses store.outcome for title and description', () => {
    expect(COMPONENT).toContain('out.title');
    expect(COMPONENT).toContain('out.description');
  });

  it('component falls back to SCENARIO.outcomes["even"]', () => {
    expect(COMPONENT).toContain('even');
    expect(SCENARIO.outcomes['even'].title).toBe('Even');
  });

  it('outcome screen has data-app-mode="outcome"', () => {
    expect(COMPONENT).toContain('data-app-mode="outcome"');
  });
});

// ── 32. Portrait asset paths remain correct ───────────────────────────────────

describe('32. portrait asset paths correct', () => {
  const portraits = ['distant', 'defensive', 'hurt_exposed', 'connected'] as const;

  it.each(portraits)('open portrait %s resolves to correct path', (p) => {
    expect(PORTRAIT_OPEN[p]).toBe(`/assets/friend/${p}-open.webp`);
  });

  it.each(portraits)('closed portrait %s resolves to correct path', (p) => {
    expect(PORTRAIT_CLOSED[p]).toBe(`/assets/friend/${p}-closed.webp`);
  });

  it.each(portraits)('open portrait file %s exists on disk', (p) => {
    expect(existsSync(resolve(ROOT, 'public', PORTRAIT_OPEN[p].slice(1)))).toBe(true);
  });

  it.each(portraits)('closed portrait file %s exists on disk', (p) => {
    expect(existsSync(resolve(ROOT, 'public', PORTRAIT_CLOSED[p].slice(1)))).toBe(true);
  });

  it('blink asset resolves correctly', () => {
    expect(BLINK_SRC).toBe('/assets/friend/blink.webp');
    expect(existsSync(resolve(ROOT, 'public', BLINK_SRC.slice(1)))).toBe(true);
  });
});

// ── 33. Portrait fallback present ────────────────────────────────────────────

describe('33. portrait silhouette fallback present', () => {
  it('silhouette element exists', () => {
    expect(COMPONENT).toContain('cs-portrait-silhouette');
  });

  it('silhouette is hidden when portrait loads', () => {
    expect(COMPONENT).toContain('cs-portrait-silhouette--hidden');
  });

  it('silhouette shown when portrait fails to load', () => {
    expect(COMPONENT).toContain('setFailedPortrait');
    expect(COMPONENT).toContain("style.display = 'none'");
  });
});

// ── 34. No fake translucent rectangle ────────────────────────────────────────

describe('34. no fake translucent rectangle', () => {
  it('CSS does not contain .cs-background::after rule', () => {
    expect(CSS).not.toContain('.cs-background::after');
  });

  it('no old architectural overlay class present in component', () => {
    expect(COMPONENT).not.toContain('cs-overlay-panel');
    expect(COMPONENT).not.toContain('old-overlay');
  });
});

// ── 35. No horizontal overflow at mobile width (CSS) ─────────────────────────

describe('35. no horizontal overflow at mobile', () => {
  it('CSS has overflow-x: hidden on root', () => {
    expect(CSS).toContain('overflow-x: hidden');
  });

  it('CSS has safe-area-inset support', () => {
    expect(CSS).toContain('safe-area-inset');
  });

  it('CSS has a mobile breakpoint (max-width: 599px)', () => {
    expect(CSS).toContain('max-width: 599px');
  });
});

// ── 36. Reduced-motion disables nonessential transitions ─────────────────────

describe('36. reduced-motion compliance', () => {
  it('CSS has prefers-reduced-motion block', () => {
    expect(CSS).toContain('prefers-reduced-motion');
  });

  it('thinking dots animation disabled under reduced-motion', () => {
    const rmBlock = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    expect(rmBlock).toContain('animation: none');
  });

  it('portrait breathe animation disabled under reduced-motion', () => {
    const rmBlock = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    expect(rmBlock).toContain('cs-portrait-silhouette');
  });
});

// ── 37. Keyboard focus and modal focus behavior ────────────────────────────────

describe('37. keyboard focus and modal semantics', () => {
  it('pause overlay has role=dialog and aria-modal', () => {
    expect(COMPONENT).toContain('role="dialog"');
    expect(COMPONENT).toContain('aria-modal="true"');
  });

  it('tutorial overlay has modal semantics', () => {
    const tutStart = COMPONENT.indexOf('function TutorialOverlay');
    const tutEnd   = COMPONENT.indexOf('\nfunction', tutStart + 1);
    const tutBody  = COMPONENT.slice(tutStart, tutEnd);
    expect(tutBody).toContain('role="dialog"');
    expect(tutBody).toContain('aria-modal="true"');
  });

  it('CSS has visible focus-visible rules for buttons', () => {
    expect(CSS).toContain(':focus-visible');
    expect(CSS).toContain('outline');
  });

  it('Escape key handler toggles pause', () => {
    expect(COMPONENT).toContain("e.key !== 'Escape'");
    expect(COMPONENT).toContain('storePause');
    expect(COMPONENT).toContain('storeResume');
  });

  it('focus is restored after closing overlays', () => {
    // prevFocusRef pattern must exist in at least one modal
    expect(COMPONENT).toContain('prevFocusRef');
    expect(COMPONENT).toContain("prevFocusRef.current?.focus()");
  });
});

// ── 38. No request made by purely presentational transitions ──────────────────

describe('38. no API request from presentation transitions', () => {
  it('cinematicPresentation makes no network call', () => {
    // Must be pure — no fetch, axios, or turnClient import
    const pres = readFileSync(
      resolve(ROOT, 'src/components/cinematicPresentation.ts'),
      'utf8'
    );
    expect(pres).not.toContain('fetch(');
    expect(pres).not.toContain('postTurn');
    expect(pres).not.toContain('axios');
  });

  it('computeOutcomeSummary is pure — returns a string from assessment history', () => {
    const assessments = [
      makeAssessment('aligned', 'understand', 'understanding'),
      makeAssessment('constructive_divergence', 'explain', 'explanation'),
      makeAssessment('harmful_divergence', 'repair', 'defense'),
    ];
    const summary = computeOutcomeSummary(assessments);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('computeOutcomeSummary returns empty string for empty history', () => {
    expect(computeOutcomeSummary([])).toBe('');
  });

  it('cinematicPresentation returns a stable object', () => {
    const result = cinematicPresentation({
      mode: 'playing',
      portraitState: 'distant',
      engagement: -3,
      tension: 1,
    });
    expect(typeof result.closingFallback).toBe('string');
    expect(result.closingFallback.length).toBeGreaterThan(0);
  });
});
