export type PortraitState =
  | "distant"
  | "defensive"
  | "hurt_exposed"
  | "connected";

export type Intent =
  | "acknowledge"
  | "defend"
  | "minimize"
  | "redirect"
  | "repair"
  | "pressure"
  | "unclear";

export type TranscriptEntry = {
  speaker: "player" | "character";
  text: string;
};

export type GameState = {
  engagement: number;
  tension: number;
  portraitState: PortraitState;
};

export type TurnRequest = {
  scenarioId: string;
  turnIndex: number;
  playerText: string;
  state: {
    engagement: number;
    tension: number;
  };
  recentTranscript: TranscriptEntry[];
};

export type TurnResponse = {
  characterText: string;
  assessment: {
    intent: Intent;
    engagementDelta: number;
    tensionDelta: number;
  };
  presentation: {
    portraitState: PortraitState;
  };
};

export type ModelOutput = {
  characterText: string;
  assessment: {
    intent: string;
    engagementDelta: number;
    tensionDelta: number;
  };
};
