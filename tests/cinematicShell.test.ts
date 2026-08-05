import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  BLINK_SRC,
  CAFE_BACKGROUND,
  PORTRAIT_CLOSED,
  PORTRAIT_DATA_STATE,
  PORTRAIT_OPEN,
} from '../src/components/cinematicPresentation';

const ROOT = resolve(__dirname, '..');
const COMPONENT = readFileSync(resolve(ROOT, 'src/components/ConversationScene.tsx'), 'utf8');
const CSS = readFileSync(resolve(ROOT, 'src/components/ConversationScene.css'), 'utf8');
const portraits = ['distant', 'defensive', 'hurt_exposed', 'connected'] as const;

describe('cinematic asset contract', () => {
  it('uses the canonical café background', () => {
    expect(CAFE_BACKGROUND).toBe('/assets/cafe/cafe-window-afternoon.webp');
    expect(CSS).toContain("url('/assets/cafe/cafe-window-afternoon.webp')");
  });
  it.each(portraits)('maps open %s portrait to a WebP asset', (portrait) => {
    expect(PORTRAIT_OPEN[portrait]).toBe(`/assets/friend/${portrait}-open.webp`);
    expect(existsSync(resolve(ROOT, 'public', PORTRAIT_OPEN[portrait].slice(1)))).toBe(true);
  });
  it.each(portraits)('maps closed %s portrait to a WebP asset', (portrait) => {
    expect(PORTRAIT_CLOSED[portrait]).toBe(`/assets/friend/${portrait}-closed.webp`);
    expect(existsSync(resolve(ROOT, 'public', PORTRAIT_CLOSED[portrait].slice(1)))).toBe(true);
  });
  it('maps the blink asset', () => {
    expect(BLINK_SRC).toBe('/assets/friend/blink.webp');
    expect(existsSync(resolve(ROOT, 'public', BLINK_SRC.slice(1)))).toBe(true);
  });
  it.each(portraits)('has a stable data hook for %s', (portrait) => {
    expect(PORTRAIT_DATA_STATE[portrait]).toBe(portrait === 'hurt_exposed' ? 'hurt-exposed' : portrait);
  });
  it('does not request the unused opaque table composition', () => {
    expect(CSS).not.toContain('table-foreground.webp');
  });
  it('keeps a silhouette until the active portrait loads', () => {
    expect(COMPONENT).toContain('cs-portrait-silhouette--hidden');
    expect(COMPONENT).toContain('onLoad');
  });
  it('retains the silhouette and hides only a failed image', () => {
    expect(COMPONENT).toContain('onError');
    expect(COMPONENT).toContain("style.display = 'none'");
    expect(COMPONENT).toContain('setFailedPortrait');
  });
  it('does not restore the fake translucent architectural rectangle', () => {
    expect(CSS).not.toContain('.cs-background::after');
  });
});

describe('semantic application hooks', () => {
  it.each(['title', 'prologue', 'outcome'])(
    'exposes %s app mode',
    (mode) => expect(COMPONENT).toContain(`data-app-mode="${mode}"`)
  );
  it.each(['playing', 'paused', 'closing'])(
    'supports runtime %s mode',
    (mode) => expect(COMPONENT).toContain(`'${mode}'`)
  );
  it.each(['Start', 'Continue', 'Return to title', 'Pause', 'Resume', 'Replay', 'Send message'])(
    'has accessible functional control %s',
    (label) => expect(COMPONENT).toContain(label)
  );
  it('labels intention, connection, pressure, and final closing regions', () => {
    expect(COMPONENT).toContain('What are you trying to do?');
    expect(COMPONENT).toContain('Connection state');
    expect(COMPONENT).toContain('Pressure state');
    expect(COMPONENT).toContain('Final closing');
  });
  it('contains no active rehearsal or imagined-response interface', () => {
    expect(COMPONENT.toLowerCase()).not.toContain('rehears');
    expect(COMPONENT).not.toContain('imaginedResponse');
  });
});
