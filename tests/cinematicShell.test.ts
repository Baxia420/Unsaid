import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS_PATH = resolve(__dirname, '../src/components/ConversationScene.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('Cinematic Shell — CSS contract', () => {
  it('contains prefers-reduced-motion media query', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('contains reality scene-mode default (no explicit selector needed)', () => {
    // Default state is reality; CSS sets base variables on .cinematic-shell
    expect(css).toContain('.cinematic-shell');
    expect(css).toContain('/* Default: reality */');
  });

  it('contains rehearsal scene-mode selector', () => {
    expect(css).toContain('.cinematic-shell[data-scene-mode="rehearsing"]');
  });

  it('contains submitting scene-mode selector', () => {
    expect(css).toContain('.cinematic-shell[data-scene-mode="submitting"]');
  });

  it('contains all portrait-state selectors', () => {
    expect(css).toContain('.portrait[data-portrait-state="distant"]');
    expect(css).toContain('.portrait[data-portrait-state="defensive"]');
    expect(css).toContain('.portrait[data-portrait-state="hurt_exposed"]');
    expect(css).toContain('.portrait[data-portrait-state="connected"]');
  });

  it('contains snap-back animation', () => {
    expect(css).toContain('@keyframes snap-back');
    expect(css).toContain('.cinematic-shell[data-has-snapped="true"]');
  });

  it('contains breathing animation hook', () => {
    expect(css).toContain('@keyframes breathe');
  });

  it('contains blink animation hook', () => {
    expect(css).toContain('@keyframes blink');
  });

  it('contains mouth-move animation hook', () => {
    expect(css).toContain('@keyframes mouth-move');
  });

  it('contains responsive mobile rules', () => {
    expect(css).toContain('@media (max-width: 640px)');
  });

  it('contains desktop 16:9 optimization', () => {
    expect(css).toContain('@media (min-aspect-ratio: 16/9)');
  });

  it('contains portrait placeholder fallback', () => {
    expect(css).toContain('.portrait-placeholder');
  });

  it('contains cafe background layer', () => {
    expect(css).toContain('.cafe-bg');
  });

  it('contains foreground drink object', () => {
    expect(css).toContain('.drink-object');
  });

  it('contains thinking indicator', () => {
    expect(css).toContain('.thinking-indicator');
  });

  it('contains dialogue-rehearsed treatment', () => {
    expect(css).toContain('.dialogue-rehearsed');
  });

  it('contains outcome overlay', () => {
    expect(css).toContain('.outcome-overlay');
  });

  it('contains sr-only transcript class', () => {
    expect(css).toContain('.sr-only');
  });
});
