export type PortraitState =
  | 'distant'
  | 'defensive'
  | 'hurt_exposed'
  | 'connected';

export type PlayerIntent = 'understand' | 'acknowledge' | 'explain' | 'repair';

export type PerceivedImpact =
  | 'understanding'
  | 'acknowledgment'
  | 'explanation'
  | 'repair'
  | 'defense'
  | 'minimization'
  | 'pressure'
  | 'avoidance'
  | 'unclear';

export type Alignment =
  | 'aligned'
  | 'constructive_divergence'
  | 'harmful_divergence';

export type AppMode =
  | 'title'
  | 'prologue'
  | 'playing'
  | 'paused'
  | 'closing'
  | 'outcome';

export type OutcomeId = 'even' | 'smoothed' | 'the_speech';

export interface TranscriptEntry {
  speaker: 'player' | 'character';
  text: string;
}

export interface EmotionalState {
  engagement: number;
  tension: number;
}

export interface GameState extends EmotionalState {
  portraitState: PortraitState;
}

export interface TurnAssessment {
  selectedIntent: PlayerIntent;
  perceivedImpact: PerceivedImpact;
  impactReason: string;
  alignment: Alignment;
  engagementDelta: number;
  tensionDelta: number;
}

export interface FinalClosures {
  even: string;
  smoothed: string;
  the_speech: string;
}

export interface TurnRequest {
  scenarioId: string;
  turnIndex: number;
  playerText: string;
  selectedIntention: PlayerIntent;
  state: EmotionalState;
  recentTranscript: TranscriptEntry[];
  narrativeState?: import('./narrative').NarrativeState;
}

export interface TurnNarrativeMeta {
  sceneMove: import('./narrative').SceneMove;
  memoryId: string | null;
  activeBelief: import('./narrative').ActiveBelief;
  providerSource?: string;
  latencyMs?: number;
}

export interface TurnResponse {
  characterText: string;
  assessment: Omit<TurnAssessment, 'selectedIntent' | 'alignment'>;
  presentation: { portraitState: PortraitState };
  finalClosures?: FinalClosures;
  narrative?: { state: import('./narrative').NarrativeState; meta: TurnNarrativeMeta };
}

export interface ModelOutput {
  characterText: string;
  perceivedImpact: PerceivedImpact;
  impactReason: string;
  engagementDelta: number;
  tensionDelta: number;
  finalClosures?: FinalClosures;
}

export interface StateBounds {
  engagement: { min: number; max: number };
  tension: { min: number; max: number };
}

export interface DeltaBounds {
  engagementDelta: { min: number; max: number };
  tensionDelta: { min: number; max: number };
}

export interface OutcomeDef {
  id: OutcomeId;
  title: string;
  description: string;
}
