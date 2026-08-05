/**
 * Cinematic presentation constants — Stage 1 Milestone 4A
 *
 * Pure visual mappings. No gameplay logic.
 * Both ConversationScene.tsx and tests import from here.
 */

import type { AppMode, PortraitState, TurnAssessment } from '../game/types';
import { SCENARIO } from '../game/scenario';

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

// ── Visual scene-state values (presentation only) ────────────────────────────

export type VisualSceneState =
  | 'reality'
  | 'submitting'
  | 'error'
  | 'outcome';

// ── Cinematic presentation helpers ───────────────────────────────────────────

export interface CinematicPresentationInput {
  mode:         AppMode;
  portraitState: PortraitState | null | undefined;
  engagement:   number;
  tension:      number;
}

export interface CinematicPresentationOutput {
  closingFallback: string;
  visualState:     VisualSceneState;
}

/**
 * Returns presentation-only values derived from game state.
 * Called by ConversationScene — does not mutate store.
 */
export function cinematicPresentation(
  input: CinematicPresentationInput,
): CinematicPresentationOutput {
  const { mode } = input;

  const visualState: VisualSceneState =
    mode === 'outcome' ? 'outcome'
    : 'reality';

  return {
    closingFallback: SCENARIO.fallbackClosures.even,
    visualState,
  };
}

// ── Outcome summary computation (presentation only) ──────────────────────────

/**
 * Computes a concise human-readable reflection from assessment history.
 * Called only in the outcome screen. Does not modify store or core logic.
 */
export function computeOutcomeSummary(assessments: TurnAssessment[]): string {
  if (!assessments || assessments.length === 0) return '';

  const aligned       = assessments.filter(a => a.alignment === 'aligned').length;
  const constructive  = assessments.filter(a => a.alignment === 'constructive_divergence').length;
  const harmful       = assessments.filter(a => a.alignment === 'harmful_divergence').length;
  const total         = assessments.length;

  // Most frequent intent
  const intentCounts: Record<string, number> = {};
  for (const a of assessments) {
    intentCounts[a.selectedIntent] = (intentCounts[a.selectedIntent] ?? 0) + 1;
  }
  const topIntent = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const parts: string[] = [];

  if (aligned > constructive && aligned > harmful) {
    parts.push(`Your intentions landed as intended in ${aligned} of ${total} turns.`);
  } else if (harmful > aligned) {
    parts.push(`In ${harmful} turn${harmful !== 1 ? 's' : ''}, your words landed differently than intended.`);
  } else {
    parts.push(`Across ${total} turns, the conversation shifted between connection and distance.`);
  }

  if (topIntent) {
    const label = topIntent.charAt(0).toUpperCase() + topIntent.slice(1);
    parts.push(`You most often tried to ${label.toLowerCase()}.`);
  }

  if (constructive > 0) {
    parts.push(`${constructive} turn${constructive !== 1 ? 's' : ''} diverged constructively — what you said mattered, even if differently than planned.`);
  }

  return parts.join(' ');
}
