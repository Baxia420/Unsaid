import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  generateReadTheRoomHint,
  getConnectionLabel,
  getPressureLabel,
  getReflection,
  getReviewSummary,
  humanizeLabel,
} from '../src/components/cinematicPresentation';
import { SCENARIO } from '../src/game/scenario';
import { createInitialState, useGameStore } from '../src/game/store';
import { buildLivePrompt } from '../server/turn/prompt';
import { makeRequest } from './helpers';
import type { TurnAssessment } from '../src/game/types';

const ROOT = resolve(__dirname, '..');
const COMPONENT = readFileSync(resolve(ROOT, 'src/components/ConversationScene.tsx'), 'utf8');
const CSS = readFileSync(resolve(ROOT, 'src/components/ConversationScene.css'), 'utf8');

const assessment: TurnAssessment = {
  selectedIntent: 'acknowledge',
  perceivedImpact: 'acknowledgment',
  impactReason: 'You named the harm without asking her to excuse it.',
  alignment: 'aligned',
  engagementDelta: 1,
  tensionDelta: -1,
};

describe('three-part player-controlled prologue', () => {
  beforeEach(() => useGameStore.setState(createInitialState(0)));

  it('contains exactly the three public story sections in order', () => {
    expect(SCENARIO.prologueParts).toHaveLength(3);
    const [friendship, promise, lie] = SCENARIO.prologueParts.map((part) =>
      [part.paragraphs, part.postQuoteParagraphs ?? [], part.highlightQuote ?? ''].flat().join(' ')
    );
    expect(friendship).toMatch(/nine years/i);
    expect(friendship).toMatch(/first public photography exhibition/i);
    expect(friendship).toMatch(/six people/i);
    expect(promise).toMatch(/helped her decide/i);
    expect(promise).toMatch(/promised/i);
    expect(promise).toMatch(/forgot/i);
    expect(promise).toMatch(/already begun/i);
    expect(promise).toMatch(/stayed away/i);
    expect(lie).toMatch(/Something came up/i);
    expect(lie).toMatch(/three weeks/i);
    expect(lie).toMatch(/café/i);
    expect(lie).toMatch(/already waiting/i);
  });

  it('does not expose private memories before the café', () => {
    const publicText = SCENARIO.prologue.join(' ').toLowerCase();
    for (const hidden of ['empty chair', 'checked the door', 'guest asked', 'defended', 'packed up', 'missed the player', 'friendship to survive']) {
      expect(publicText).not.toContain(hidden);
    }
  });

  it('moves forward, backward, and skips without committing a turn', () => {
    const store = () => useGameStore.getState();
    store().start();
    store().nextProloguePart();
    expect(store()).toMatchObject({ mode: 'prologue', prologuePart: 1, turnIndex: 0 });
    store().prevProloguePart();
    expect(store()).toMatchObject({ mode: 'prologue', prologuePart: 0, turnIndex: 0 });
    store().skipPrologue();
    expect(store()).toMatchObject({ mode: 'playing', turnIndex: 0 });
    expect(store().transcript).toEqual([{ speaker: 'character', text: SCENARIO.openingLine }]);
  });

  it('shows Enter the Café only for the final part', () => {
    const prologueBlock = COMPONENT.slice(
      COMPONENT.indexOf("if (mode === 'prologue')"),
      COMPONENT.indexOf('// ─── OUTCOME SCREEN'),
    );
    expect(prologueBlock).toContain('Continue');
    expect(prologueBlock).toContain('Back');
    expect(prologueBlock).toContain('Skip Prologue');
    expect(prologueBlock).toContain("isLastPart ?");
    expect(prologueBlock).toContain('Enter the Café');
    expect(prologueBlock).not.toContain('Return to title');
  });
});

describe('local Read the room observation', () => {
  it('changes with emotional and recent-impact context without changing game state', () => {
    const before = useGameStore.getState();
    const guarded = generateReadTheRoomHint({
      engagement: -5, tension: 2, selectedIntention: null,
      lastPerceivedImpact: null, lastAlignment: null,
      turnIndex: 1, totalTurns: 10, recentAssessments: [],
    });
    const softening = generateReadTheRoomHint({
      engagement: 4, tension: 1, selectedIntention: 'acknowledge',
      lastPerceivedImpact: 'acknowledgment', lastAlignment: 'aligned',
      turnIndex: 7, totalTurns: 10, recentAssessments: [assessment],
    });
    expect(guarded).not.toBe(softening);
    expect(useGameStore.getState()).toEqual(before);
  });

  it('is dismissible, accessible, and does not submit or call the network', () => {
    const block = COMPONENT.slice(
      COMPONENT.indexOf('function handleToggleHint'),
      COMPONENT.indexOf('const handleSubmit'),
    );
    expect(COMPONENT).toContain('aria-label="Read the room hint"');
    expect(COMPONENT).toContain('aria-label="Dismiss hint"');
    expect(block).not.toContain('submitTurn');
    expect(block).not.toContain('postTurn');
  });
});

describe('restrained motion and outcome presentation', () => {
  it('provides reduced-motion overrides for every new animated layer', () => {
    const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const selector of ['.cs-prologue-bg', '.cs-outcome-bg', '.cs-outcome-portrait-wrap', '.cs-dialogue-card', '.cs-hud-bar-fill']) {
      expect(reduced).toContain(selector);
    }
    expect(CSS).not.toMatch(/particle|screen-shake|flash-effect/i);
  });

  it('uses human connection and pressure labels', () => {
    expect(getConnectionLabel(-8)).toBe('Distant');
    expect(getConnectionLabel(7)).toBe('Reconnecting');
    expect(getPressureLabel(-8)).toBe('Calm');
    expect(getPressureLabel(7)).toBe('Overwhelming');
    expect(humanizeLabel('harmful_divergence')).toBe('Harmful Divergence');
  });

  it('keeps aggregate counts inside optional Review Conversation', () => {
    const outcomeBlock = COMPONENT.slice(
      COMPONENT.indexOf("if (mode === 'outcome')"),
      COMPONENT.indexOf('// ═══════════════════════════════════════════════════════', COMPONENT.indexOf("if (mode === 'outcome')")),
    );
    expect(outcomeBlock).toContain('End of Conversation');
    expect(outcomeBlock).toContain('Connection');
    expect(outcomeBlock).toContain('Pressure');
    expect(outcomeBlock).toContain('Play Again');
    expect(outcomeBlock).toContain('Review Conversation');
    expect(outcomeBlock).toContain('Return to Title');
    expect(outcomeBlock.indexOf('cs-outcome-summary')).toBeGreaterThan(outcomeBlock.indexOf('showReview &&'));
  });

  it('resets presentation-local state when replaying', () => {
    const resetStart = COMPONENT.indexOf('function resetConversationPresentation');
    const restartStart = COMPONENT.indexOf('function handleRestart');
    const restartEnd = COMPONENT.indexOf('\n  }', restartStart);
    expect(resetStart).toBeGreaterThanOrEqual(0);
    expect(COMPONENT.slice(restartStart, restartEnd)).toContain('resetConversationPresentation()');
  });

  it('uses styled controls for impact and outcome actions', () => {
    expect(COMPONENT).toContain('className="cs-impact-continue-btn"');
    expect(COMPONENT).toContain('cs-outcome-btn--primary');
    expect(CSS).toContain('.cs-impact-continue-btn');
    expect(CSS).toContain('.cs-outcome-btn--primary');
  });

  it('derives reflection and review without changing outcome selection', () => {
    expect(getReflection([assessment], 2, 0)).toMatch(/trust|moved/i);
    expect(getReviewSummary([assessment])).toMatchObject({ alignedMoments: 1, harmfulDivergences: 0 });
  });
});

describe('natural dynamic-conversation prompt', () => {
  const prompt = buildLivePrompt(makeRequest({
    selectedIntention: 'repair',
    playerText: 'I can wait. You do not have to decide anything tonight.',
    recentTranscript: [
      { speaker: 'character', text: SCENARIO.openingLine },
      { speaker: 'player', text: 'I forgot, then I lied because I was ashamed.' },
      { speaker: 'character', text: 'Thank you for finally saying that plainly.' },
    ],
  })).system;

  it('contains the full canon and gradual private memories', () => {
    for (const phrase of ['first public photography exhibition', 'six invited guests', 'helped choose', 'empty chair', 'checked the door', 'defended the player', 'packed up', 'missed the player', 'friendship to survive']) {
      expect(prompt).toContain(phrase);
    }
    expect(prompt).toContain('reveal gradually');
    expect(prompt).toContain('not a fixed-turn sequence');
  });

  it('requires natural length, direct response, emotional movement, and varied openings', () => {
    for (const phrase of ['Match the response length', 'respond directly', 'private memory has been revealed', 'Vary sentence length', 'guarded, then honest, then painful, then vulnerable, then uncertain']) {
      expect(prompt).toContain(phrase);
    }
  });

  it('keeps every intention viable and supports resolution and recovery', () => {
    expect(prompt).toContain('Every selected intention—understand, acknowledge, explain, and repair—can help or harm');
    expect(prompt).toContain('repaired misunderstandings');
    expect(prompt).toContain('do not invent accusations');
    expect(prompt).toContain('Recovery is possible');
    expect(prompt).toContain('without instant forgiveness');
  });

  it('forbids clinical language and makes assessment reasons address You', () => {
    for (const term of ['emotional labor', 'accountability framework', 'intent versus impact', 'holding space', 'processing', 'communication pattern']) {
      expect(prompt).toContain(term);
    }
    expect(prompt).toContain('Address the speaker as "You"');
    expect(prompt).toContain('never say "The player"');
  });
});
