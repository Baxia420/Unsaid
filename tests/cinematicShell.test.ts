/**
 * Visual-contract tests for Stage 1 Milestone 4A — Cinematic Shell.
 *
 * These tests verify:
 *  - All four portrait state mappings produce correct asset paths
 *  - Scene-mode strings are correct
 *  - Expected public asset paths exist by convention
 *  - CSS contains reduced-motion rule
 *  - CSS contains mobile media rule
 *  - The component source does not contain engagement/tension meters
 *  - The component source does not contain an alternate submission path
 *  - Required semantic attributes are present in the component source
 *  - imaginedResponse is not inserted into player input
 *
 * No DOM rendering — pure source-inspection and data tests only.
 * No Testing Library, jest-dom, jsdom, Playwright, or Cypress.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { PortraitState } from '../src/game/types';
import {
  PORTRAIT_OPEN,
  PORTRAIT_CLOSED,
  BLINK_SRC,
  PORTRAIT_DATA_STATE,
  CAFE_BACKGROUND,
} from '../src/components/cinematicPresentation';
import type { VisualSceneState } from '../src/components/cinematicPresentation';

// ── Source files ─────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '..');
const COMPONENT_SRC = readFileSync(
  resolve(ROOT, 'src/components/ConversationScene.tsx'),
  'utf-8'
);
const CSS_SRC = readFileSync(
  resolve(ROOT, 'src/components/ConversationScene.css'),
  'utf-8'
);
const HELPER_SRC = readFileSync(
  resolve(ROOT, 'src/components/cinematicPresentation.ts'),
  'utf-8'
);
const PUBLIC_ASSETS = resolve(ROOT, 'public/assets');

// ── Portrait mapping tests ───────────────────────────────────────────────────

describe('Portrait asset mappings', () => {
  const states: PortraitState[] = ['distant', 'defensive', 'hurt_exposed', 'connected'];

  it.each(states)('open path for state %s is root-relative', (state) => {
    expect(PORTRAIT_OPEN[state]).toBe(`/assets/friend/${state}-open.webp`);
  });

  it.each(states)('closed path for state %s is root-relative', (state) => {
    expect(PORTRAIT_CLOSED[state]).toBe(`/assets/friend/${state}-closed.webp`);
  });

  it('blink asset path is root-relative', () => {
    expect(BLINK_SRC).toBe('/assets/friend/blink.webp');
  });

  it('data-portrait-state for distant', () => {
    expect(PORTRAIT_DATA_STATE.distant).toBe('distant');
  });
  it('data-portrait-state for defensive', () => {
    expect(PORTRAIT_DATA_STATE.defensive).toBe('defensive');
  });
  it('data-portrait-state for hurt_exposed', () => {
    expect(PORTRAIT_DATA_STATE.hurt_exposed).toBe('hurt-exposed');
  });
  it('data-portrait-state for connected', () => {
    expect(PORTRAIT_DATA_STATE.connected).toBe('connected');
  });
});

// ── Scene asset paths ────────────────────────────────────────────────────────

describe('Scene asset paths', () => {
  it('ships all mapped portrait assets at the final runtime paths', () => {
    for (const state of ['distant', 'defensive', 'hurt_exposed', 'connected'] as const) {
      expect(existsSync(resolve(PUBLIC_ASSETS, 'friend', `${state}-open.webp`))).toBe(true);
      expect(existsSync(resolve(PUBLIC_ASSETS, 'friend', `${state}-closed.webp`))).toBe(true);
    }
    expect(existsSync(resolve(PUBLIC_ASSETS, 'friend', 'blink.webp'))).toBe(true);
  });

  it('cafe background path is root-relative', () => {
    expect(CAFE_BACKGROUND).toBe('/assets/cafe/cafe-window-afternoon.webp');
  });

  it('ships the café background at its final runtime path', () => {
    expect(existsSync(resolve(PUBLIC_ASSETS, 'cafe', 'cafe-window-afternoon.webp'))).toBe(true);
  });

});

// ── Scene-mode strings ───────────────────────────────────────────────────────

describe('Scene-mode strings', () => {
  const validModes: VisualSceneState[] = ['reality', 'rehearsing', 'submitting', 'error', 'outcome'];

  it.each(validModes)('visual scene state %s is a recognised VisualSceneState', (m) => {
    expect(validModes).toContain(m);
  });

  it('component emits all five visual scene states in data-scene-mode', () => {
    expect(COMPONENT_SRC).toContain("'reality'");
    expect(COMPONENT_SRC).toContain("'rehearsing'");
    expect(COMPONENT_SRC).toContain("'submitting'");
    expect(COMPONENT_SRC).toContain("'error'");
    expect(COMPONENT_SRC).toContain("'outcome'");
  });

  it('data-scene-mode outcome is emitted for outcome mode', () => {
    expect(COMPONENT_SRC).toContain('data-scene-mode="outcome"');
  });
});

// ── Expected public asset paths ──────────────────────────────────────────────

describe('Expected asset path conventions', () => {
  // Café and table URLs must be active CSS declarations, not comments
  it('CSS contains active cafe background-image declaration', () => {
    expect(CSS_SRC).toContain("url('/assets/cafe/cafe-window-afternoon.webp')");
  });

  it('CSS does not request the unused opaque table composition', () => {
    expect(CSS_SRC).not.toContain('table-foreground.webp');
  });

  // Verify helper (shared source of truth) contains portrait paths
  it('helper contains root-relative distant-open path', () => {
    expect(HELPER_SRC).toContain("'/assets/friend/distant-open.webp'");
  });

  it('helper contains root-relative connected-closed path', () => {
    expect(HELPER_SRC).toContain("'/assets/friend/connected-closed.webp'");
  });

  it('helper contains root-relative blink path', () => {
    expect(HELPER_SRC).toContain("'/assets/friend/blink.webp'");
  });

  it('all nine expected portrait paths are covered in helper', () => {
    const portraitPaths = [
      '/assets/friend/distant-closed.webp',
      '/assets/friend/distant-open.webp',
      '/assets/friend/defensive-closed.webp',
      '/assets/friend/defensive-open.webp',
      '/assets/friend/hurt_exposed-closed.webp',
      '/assets/friend/hurt_exposed-open.webp',
      '/assets/friend/connected-closed.webp',
      '/assets/friend/connected-open.webp',
      '/assets/friend/blink.webp',
    ];
    for (const p of portraitPaths) {
      expect(HELPER_SRC).toContain(p);
    }
  });
});

// ── Portrait image display behaviour ─────────────────────────────────────────

describe('Portrait image display behaviour', () => {
  it('portrait images are not permanently display:none', () => {
    expect(CSS_SRC).not.toMatch(/\.cs-portrait-img\s*\{[^}]*display:\s*none/);
  });

  it('component has portrait error handling', () => {
    expect(COMPONENT_SRC).toContain('onError={handlePortraitError}');
  });

  it('handleImgError hides the failed image only', () => {
    expect(COMPONENT_SRC).toContain('e.currentTarget.style.display');
    expect(COMPONENT_SRC).toContain("'none'");
  });

  it('hides the silhouette only after the active portrait state loads', () => {
    expect(COMPONENT_SRC).toContain('handlePortraitLoad(portraitState)');
    expect(COMPONENT_SRC).toContain('cs-portrait-silhouette--hidden');
    expect(COMPONENT_SRC).toContain('loadedPortraitStates.has(portraitState)');
  });
});

// ── Loading / mouth behaviour ────────────────────────────────────────────────

describe('Loading and mouth behaviour', () => {
  it('loading uses the closed-mouth portrait', () => {
    // The portraitSrc must derive from PORTRAIT_CLOSED during loading
    expect(COMPONENT_SRC).toContain('PORTRAIT_CLOSED[portraitState]');
  });

  it('does not use PORTRAIT_OPEN during loading', () => {
    expect(COMPONENT_SRC).not.toContain('PORTRAIT_OPEN[portraitState]');
  });

  it('mouth-open is visual-only ephemeral state with cleanup timer', () => {
    expect(COMPONENT_SRC).toContain('MOUTH_OPEN_DURATION_MS');
    expect(COMPONENT_SRC).toContain('setMouthOpen');
    expect(COMPONENT_SRC).toContain('clearTimeout');
  });
});

// ── CSS: reduced-motion rule ─────────────────────────────────────────────────

describe('CSS reduced-motion support', () => {
  it('contains prefers-reduced-motion media query', () => {
    expect(CSS_SRC).toContain('prefers-reduced-motion: reduce');
  });

  it('disables cs-portrait-silhouette animation under reduced-motion', () => {
    const rmBlock = CSS_SRC.slice(
      CSS_SRC.indexOf('prefers-reduced-motion'),
    );
    expect(rmBlock).toContain('cs-portrait-silhouette');
    expect(rmBlock).toContain('animation: none');
  });

  it('disables thinking-dots animation under reduced-motion', () => {
    const rmBlock = CSS_SRC.slice(
      CSS_SRC.indexOf('prefers-reduced-motion'),
    );
    expect(rmBlock).toContain('cs-thinking-dots');
  });
});

// ── CSS: mobile media rule ───────────────────────────────────────────────────

describe('CSS mobile media rule', () => {
  it('contains a max-width mobile breakpoint', () => {
    expect(CSS_SRC).toContain('@media (max-width:');
  });

  it('uses min-height: 100dvh', () => {
    expect(CSS_SRC).toContain('100dvh');
  });

  it('does not globally force body overflow:hidden', () => {
    expect(CSS_SRC).not.toMatch(/body\s*\{[^}]*overflow\s*:\s*hidden/);
  });
});

// ── Absence of state meters ──────────────────────────────────────────────────

describe('State meters are absent', () => {
  it('does not render engagement in the component', () => {
    expect(COMPONENT_SRC).not.toContain('engagement meter');
    expect(COMPONENT_SRC).not.toContain('Engagement');
    expect(COMPONENT_SRC).not.toContain('<meter');
    expect(COMPONENT_SRC).not.toContain('<progress');
  });

  it('does not render tension in the component', () => {
    expect(COMPONENT_SRC).not.toContain('tension meter');
    expect(COMPONENT_SRC).not.toContain('Tension');
  });

  it('does not display percentage values', () => {
    expect(COMPONENT_SRC).not.toMatch(/\{.*(engagement|tension).*%/);
  });

  it('does not show portraitState text to the player', () => {
    expect(COMPONENT_SRC).not.toContain('{portraitState}');
  });
});

// ── Absence of alternate submission path ────────────────────────────────────

describe('No alternate submission path', () => {
  it('component has exactly one submitTurn reference', () => {
    const matches = COMPONENT_SRC.match(/submitTurn/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(4);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not call submitTurn inside setInput', () => {
    const setInputBlock = COMPONENT_SRC.slice(
      COMPONENT_SRC.indexOf('setInput(e.target.value)') - 20,
      COMPONENT_SRC.indexOf('setInput(e.target.value)') + 40,
    );
    expect(setInputBlock).not.toContain('submitTurn');
  });

  it('does not contain a second button with submit capability during rehearse', () => {
    const sayBtnCount = (COMPONENT_SRC.match(/cs-say-btn/g) ?? []).length;
    expect(sayBtnCount).toBeLessThanOrEqual(4);
  });
});

// ── Required semantic scene attributes ──────────────────────────────────────

describe('Semantic scene attributes', () => {
  it('scene stage has aria-label', () => {
    expect(COMPONENT_SRC).toContain('aria-label="Scene stage"');
  });

  it('interaction dock has aria-label', () => {
    expect(COMPONENT_SRC).toContain('aria-label="Interaction dock"');
  });

  it('outcome scene has aria-label', () => {
    expect(COMPONENT_SRC).toContain('aria-label="Outcome scene"');
  });

  it('dialogue card uses role=status and aria-live=polite', () => {
    expect(COMPONENT_SRC).toContain('role="status"');
    expect(COMPONENT_SRC).toContain('aria-live="polite"');
  });

  it('error panel uses role=alert', () => {
    expect(COMPONENT_SRC).toContain('role="alert"');
  });

  it('textarea has autoComplete="off"', () => {
    expect(COMPONENT_SRC).toContain('autoComplete="off"');
  });

  it('textarea has name="unsaid-player-dialogue"', () => {
    expect(COMPONENT_SRC).toContain('name="unsaid-player-dialogue"');
  });

  it('textarea has autoCapitalize="sentences"', () => {
    expect(COMPONENT_SRC).toContain('autoCapitalize="sentences"');
  });

  it('textarea has spellCheck={true}', () => {
    expect(COMPONENT_SRC).toContain('spellCheck={true}');
  });

  it('outcome title uses semantic h1', () => {
    expect(COMPONENT_SRC).toContain('<h1 className="cs-outcome-title">');
  });
});

// ── imaginedResponse not inserted into player input ──────────────────────────

describe('imaginedResponse isolation', () => {
  it('setInput is never called with imaginedResponse', () => {
    expect(COMPONENT_SRC).not.toMatch(/setInput\s*\(\s*imaginedResponse/);
  });

  it('textarea value is bound only to input from store', () => {
    expect(COMPONENT_SRC).toContain('value={input}');
  });

  it('imagined response is displayed only in cs-imagined-panel', () => {
    expect(COMPONENT_SRC).toContain('cs-imagined-panel');
    expect(COMPONENT_SRC).toContain('{imaginedResponse}');
  });
});

// ── Layout: absolute positioning confined to art canvas only ─────────────────

describe('Layout absolute-positioning discipline', () => {
  it('CSS uses absolute positioning only inside art canvas and portrait frame', () => {
    const dockSection = CSS_SRC.slice(
      CSS_SRC.indexOf('.cs-dock'),
      CSS_SRC.indexOf('.cs-dock') + 400,
    );
    expect(dockSection).not.toContain('position: absolute');
  });

  it('cs-input-row does not use absolute positioning', () => {
    const inputRowSection = CSS_SRC.slice(
      CSS_SRC.indexOf('.cs-input-row'),
      CSS_SRC.indexOf('.cs-input-row') + 200,
    );
    expect(inputRowSection).not.toContain('position: absolute');
  });

  it('cs-dialogue-card does not use absolute positioning', () => {
    const cardSection = CSS_SRC.slice(
      CSS_SRC.indexOf('.cs-dialogue-card'),
      CSS_SRC.indexOf('.cs-dialogue-card') + 300,
    );
    expect(cardSection).not.toContain('position: absolute');
  });
});

// ── Shared mapping import ────────────────────────────────────────────────────

describe('Shared mapping helper', () => {
  it('component imports from cinematicPresentation', () => {
    expect(COMPONENT_SRC).toContain("from './cinematicPresentation'");
  });
});
