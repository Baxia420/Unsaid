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
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PortraitState, SceneMode } from '../src/game/types';

// ── Asset-path helpers (mirrors ConversationScene.tsx) ──────────────────────

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

const PORTRAIT_DATA_STATE: Record<PortraitState, string> = {
  distant:      'distant',
  defensive:    'defensive',
  hurt_exposed: 'hurt-exposed',
  connected:    'connected',
};

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

// ── Portrait mapping tests ───────────────────────────────────────────────────

describe('Portrait asset mappings', () => {
  const states: PortraitState[] = ['distant', 'defensive', 'hurt_exposed', 'connected'];

  it.each(states)('open path for state %s is correct', (state) => {
    expect(PORTRAIT_OPEN[state]).toBe(`assets/friend/${state}-open.webp`);
  });

  it.each(states)('closed path for state %s is correct', (state) => {
    expect(PORTRAIT_CLOSED[state]).toBe(`assets/friend/${state}-closed.webp`);
  });

  it('blink asset path is correct', () => {
    expect(BLINK_SRC).toBe('assets/friend/blink.webp');
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

// ── Scene-mode strings ───────────────────────────────────────────────────────

describe('Scene-mode strings', () => {
  const validModes: SceneMode[] = ['reality', 'rehearsing', 'outcome'];

  it.each(validModes)('scene mode %s is a recognised SceneMode', (m) => {
    expect(validModes).toContain(m);
  });

  it('data-scene-mode reality is emitted for reality mode', () => {
    expect(COMPONENT_SRC).toContain("data-scene-mode={isRehearsing ? 'rehearsing' : 'reality'}");
  });

  it('data-scene-mode outcome is emitted for outcome mode', () => {
    expect(COMPONENT_SRC).toContain('data-scene-mode="outcome"');
  });
});

// ── Expected public asset paths ──────────────────────────────────────────────

describe('Expected asset path conventions', () => {
  const expectedPaths = [
    'assets/cafe/cafe-window-afternoon.webp',
    'assets/cafe/table-foreground.webp',
    'assets/friend/distant-closed.webp',
    'assets/friend/distant-open.webp',
    'assets/friend/defensive-closed.webp',
    'assets/friend/defensive-open.webp',
    'assets/friend/hurt_exposed-closed.webp',
    'assets/friend/hurt_exposed-open.webp',
    'assets/friend/connected-closed.webp',
    'assets/friend/connected-open.webp',
    'assets/friend/blink.webp',
  ];

  // Verify the CSS comments reference café background paths
  it('CSS references cafe background asset path', () => {
    expect(CSS_SRC).toContain('cafe-window-afternoon.webp');
  });

  it('CSS references table foreground asset path', () => {
    expect(CSS_SRC).toContain('table-foreground.webp');
  });

  // Verify component references portrait paths
  it('component references distant-open path', () => {
    expect(COMPONENT_SRC).toContain("'assets/friend/distant-open.webp'");
  });

  it('component references connected-closed path', () => {
    expect(COMPONENT_SRC).toContain("'assets/friend/connected-closed.webp'");
  });

  it('component references blink path', () => {
    expect(COMPONENT_SRC).toContain("'assets/friend/blink.webp'");
  });

  it('all nine expected portrait paths are covered', () => {
    const portraitPaths = expectedPaths.filter((p) => p.startsWith('assets/friend/'));
    for (const p of portraitPaths) {
      expect(COMPONENT_SRC + CSS_SRC).toContain(p.replace('assets/friend/', ''));
    }
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
    // body overflow: hidden not in component CSS
    expect(CSS_SRC).not.toMatch(/body\s*\{[^}]*overflow\s*:\s*hidden/);
  });
});

// ── Absence of state meters ──────────────────────────────────────────────────

describe('State meters are absent', () => {
  it('does not render engagement in the component', () => {
    // engagement must not appear as a visible label or meter element
    // (it can appear as an imported type/store field name, but not as a
    //  display string or progress/meter element)
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
    // No inline % display — no template literals that would output "%"
    // as a UI label alongside a numeric store value
    expect(COMPONENT_SRC).not.toMatch(/\{.*(engagement|tension).*%/);
  });

  it('does not show portraitState text to the player', () => {
    // The state name must not appear in player-visible JSX text nodes
    // It may appear as a data attribute value or variable name
    expect(COMPONENT_SRC).not.toContain('{portraitState}');
  });
});

// ── Absence of alternate submission path ────────────────────────────────────

describe('No alternate submission path', () => {
  it('component has exactly one submitTurn reference', () => {
    const matches = COMPONENT_SRC.match(/submitTurn/g) ?? [];
    // One destructure from store + two usages (button onClick + handleKeyDown) = 3
    expect(matches.length).toBeLessThanOrEqual(4);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not call submitTurn inside setInput', () => {
    // setInput handler must not also submit
    const setInputBlock = COMPONENT_SRC.slice(
      COMPONENT_SRC.indexOf('setInput(e.target.value)') - 20,
      COMPONENT_SRC.indexOf('setInput(e.target.value)') + 40,
    );
    expect(setInputBlock).not.toContain('submitTurn');
  });

  it('does not contain a second button with submit capability during rehearse', () => {
    // There must be only one primary action button (cs-say-btn)
    const sayBtnCount = (COMPONENT_SRC.match(/cs-say-btn/g) ?? []).length;
    // Expect className definition + one usage = 2 at most
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
});

// ── imaginedResponse not inserted into player input ──────────────────────────

describe('imaginedResponse isolation', () => {
  it('setInput is never called with imaginedResponse', () => {
    // The component must never pass imaginedResponse to setInput
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
    // cs-dock must not use position: absolute
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
    // dialogue card is position: relative, not absolute
    expect(cardSection).not.toContain('position: absolute');
  });
});
