/**
 * Cinematic presentation constants — Stage 1 Milestone 4A
 *
 * Pure visual mappings. No gameplay logic.
 * Both ConversationScene.tsx and tests import from here.
 */

import type {
  Alignment,
  AppMode,
  PerceivedImpact,
  PlayerIntent,
  PortraitState,
  TurnAssessment,
} from '../game/types';
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

// ── Human-readable labels ────────────────────────────────────────────────────

export function getConnectionLabel(engagement: number): string {
  if (engagement <= -5) return 'Distant';
  if (engagement <= -1) return 'Fragile';
  if (engagement <= 4) return 'Present';
  return 'Reconnecting';
}

export function getPressureLabel(tension: number): string {
  if (tension <= -5) return 'Calm';
  if (tension <= -1) return 'Uneasy';
  if (tension <= 4) return 'Strained';
  return 'Overwhelming';
}

// ── Read the Room hint generation (presentation only) ──────────────────────────

export interface HintContext {
  engagement: number;
  tension: number;
  selectedIntention: PlayerIntent | null;
  lastPerceivedImpact: PerceivedImpact | null;
  lastAlignment: Alignment | null;
  turnIndex: number;
  totalTurns: number;
  recentAssessments: TurnAssessment[];
}

export function generateReadTheRoomHint(context: HintContext): string {
  const { engagement, tension, selectedIntention, lastPerceivedImpact, lastAlignment, turnIndex, totalTurns, recentAssessments } = context;

  const recentHarmful = recentAssessments.filter(a => a.alignment === 'harmful_divergence').length;
  const recentRepair = recentAssessments.filter(a => a.selectedIntent === 'repair').length;
  const recentExplain = recentAssessments.filter(a => a.selectedIntent === 'explain').length;

  // High pressure, late game
  if (tension >= 6 && turnIndex >= totalTurns - 3) {
    return 'She may not be ready to forgive you tonight. Accepting that without withdrawing could matter more than another promise.';
  }

  // High pressure
  if (tension >= 6) {
    return 'She is bracing for another explanation. Showing what you already understand may matter more than asking another question.';
  }

  // Repeated harmful divergence or avoidance
  if (recentHarmful >= 2) {
    return 'She feels responsible for guiding the conversation. Try not to make her explain the entire hurt for you.';
  }

  // Repair selected too early
  if (selectedIntention === 'repair' && turnIndex < 4) {
    return 'She may hear a solution as an attempt to end the discomfort. Repair can also mean patience and choice.';
  }

  // Useful acknowledgment
  if (lastAlignment === 'aligned' && (lastPerceivedImpact === 'acknowledgment' || lastPerceivedImpact === 'understanding')) {
    return 'She has begun responding to what you are saying instead of only defending herself. This may be a moment to stay with the feeling.';
  }

  // Constructive divergence
  if (lastAlignment === 'constructive_divergence') {
    return 'What you said reached her, even if not in the way you intended. There is room to build on this.';
  }

  // Late-game uncertainty
  if (turnIndex >= totalTurns - 3) {
    return 'There is not much time left. A small, honest moment may weigh more than a perfect one.';
  }

  // Recent repair attempts
  if (recentRepair >= 2) {
    return 'She has heard several offers to fix things. She may need to feel understood before she can believe them.';
  }

  // Recent explaining
  if (recentExplain >= 2) {
    return 'Explanations can feel like defenses when someone is still hurt. Letting her lead the next turn might help.';
  }

  // Default by engagement
  if (engagement <= -3) {
    return 'She is still guarded. Small, patient gestures may matter more than reaching for a breakthrough.';
  }
  if (engagement >= 3) {
    return 'Something is beginning to soften. This is a moment to meet her where she is, not to push further.';
  }

  return 'Watch her responses closely. What she says and what she does not say both matter.';
}

// ── Outcome summary computation (presentation only) ──────────────────────────

export interface ReviewSummary {
  mostUsedIntention: PlayerIntent | null;
  mostCommonImpact: PerceivedImpact | null;
  alignedMoments: number;
  constructiveDivergences: number;
  harmfulDivergences: number;
}

export function getReviewSummary(assessments: TurnAssessment[]): ReviewSummary {
  const intentCounts = {} as Record<PlayerIntent, number>;
  const impactCounts = {} as Record<PerceivedImpact, number>;
  let alignedMoments = 0;
  let constructiveDivergences = 0;
  let harmfulDivergences = 0;

  for (const a of assessments) {
    intentCounts[a.selectedIntent] = (intentCounts[a.selectedIntent] ?? 0) + 1;
    impactCounts[a.perceivedImpact] = (impactCounts[a.perceivedImpact] ?? 0) + 1;
    if (a.alignment === 'aligned') alignedMoments++;
    if (a.alignment === 'constructive_divergence') constructiveDivergences++;
    if (a.alignment === 'harmful_divergence') harmfulDivergences++;
  }

  const mostUsedIntention = (Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as PlayerIntent | undefined) ?? null;
  const mostCommonImpact = (Object.entries(impactCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as PerceivedImpact | undefined) ?? null;

  return { mostUsedIntention, mostCommonImpact, alignedMoments, constructiveDivergences, harmfulDivergences };
}

export function getReflection(assessments: TurnAssessment[], finalEngagement: number, finalTension: number): string {
  if (!assessments || assessments.length === 0) {
    return 'The conversation ended before it could begin.';
  }

  const summary = getReviewSummary(assessments);
  const total = assessments.length;

  // Speech pattern
  const explainRepairCount = assessments.filter(a => a.selectedIntent === 'explain' || a.selectedIntent === 'repair').length;
  if (explainRepairCount > total * 0.5 && summary.harmfulDivergences > summary.alignedMoments) {
    return 'You spent much of the conversation trying to explain, repair, or find the right answer. What she needed most was room to be hurt without being guided toward a conclusion.';
  }

  // Aligned majority
  if (summary.alignedMoments > total * 0.5 && finalEngagement > 0) {
    return 'Your words landed as you intended more often than not. The trust is not fully rebuilt, but something real moved between you.';
  }

  // Constructive majority
  if (summary.constructiveDivergences > total * 0.4) {
    return 'You did not always say the right thing, but she heard your effort. The conversation stayed open even when it was difficult.';
  }

  // Harmful majority
  if (summary.harmfulDivergences > total * 0.5) {
    return 'Much of what you said landed as distance or defense. She may need more time than this conversation could give.';
  }

  // Late tension
  if (finalTension > 4) {
    return 'The conversation ended with more pressure than it began. She may need space before she can meet you again.';
  }

  // Mixed
  return 'The conversation moved between closeness and distance. What happens next depends on what you do with what you have heard.';
}

export function humanizeLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
