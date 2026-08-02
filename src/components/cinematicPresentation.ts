/**
 * Cinematic presentation constants — Stage 1 Milestone 4A
 *
 * Pure visual mappings. No gameplay logic.
 * Both ConversationScene.tsx and tests import from here.
 */

import type { PortraitState } from '../game/types';

// ── Portrait asset paths (root-relative) ─────────────────────────────────────

export const PORTRAIT_OPEN: Record<PortraitState, string> = {
  distant:      '/assets/friend/distant-open.webp',
  defensive:    '/assets/friend/defensive-open.webp',
  hurt_exposed: '/assets/friend/hurt_exposed-open.webp',
  connected:    '/assets/friend/connected-open.webp',
};

export const PORTRAIT_CLOSED: Record<PortraitState, string> = {
  distant:      '/assets/friend/distant-closed.webp',
  defensive:    '/assets/friend/defensive-closed.webp',
  hurt_exposed: '/assets/friend/hurt_exposed-closed.webp',
  connected:    '/assets/friend/connected-closed.webp',
};

export const BLINK_SRC = '/assets/friend/blink.webp';

// ── Portrait data-state mapping (CSS hooks, not player-visible) ──────────────

export const PORTRAIT_DATA_STATE: Record<PortraitState, string> = {
  distant:      'distant',
  defensive:    'defensive',
  hurt_exposed: 'hurt-exposed',
  connected:    'connected',
};

// ── Scene asset paths ────────────────────────────────────────────────────────

export const CAFE_BACKGROUND = '/assets/cafe/cafe-window-afternoon.webp';
export const TABLE_FOREGROUND = '/assets/cafe/table-foreground.webp';

// ── Visual scene-state values (presentation only) ────────────────────────────

export type VisualSceneState =
  | 'reality'
  | 'rehearsing'
  | 'submitting'
  | 'error'
  | 'outcome';
