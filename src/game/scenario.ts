import type { StateBounds, DeltaBounds, OutcomeDef } from './types';

export type Beat = {
  turn: number;
  name: string;
  purpose: string;
  isRehearsal: boolean;
};

export const SCENARIO = {
  id: "say-it-again",
  title: "Say It Again",
  description: "A difficult café apology with a close friend.",
  openingLine: "You said you wanted to talk.",
  totalTurns: 5,
  startingState: { engagement: 0, tension: 0 },
  bounds: {
    engagement: { min: -10, max: 10 },
    tension: { min: -10, max: 10 },
  } as StateBounds,
  deltaBounds: {
    engagementDelta: { min: -3, max: 3 },
    tensionDelta: { min: -3, max: 3 },
  } as DeltaBounds,
  maxPlayerTextLength: 500,
  beats: [
    {
      turn: 1,
      name: "Polite surface",
      purpose: "Both people initially pretend the meeting is ordinary.",
      isRehearsal: false,
    },
    {
      turn: 2,
      name: "First real attempt",
      purpose: "The first required REHEARSE/SAY moment. The player tries to apologize.",
      isRehearsal: true,
    },
    {
      turn: 3,
      name: "Actual injury",
      purpose: "The friend makes clear that the pain was waiting and checking the door, not merely the missed event.",
      isRehearsal: false,
    },
    {
      turn: 4,
      name: "Correction",
      purpose: "The second required REHEARSE/SAY moment. The player can respond to the right injury.",
      isRehearsal: true,
    },
    {
      turn: 5,
      name: "Close",
      purpose: "The player sits with the consequence instead of demanding forgiveness.",
      isRehearsal: false,
    },
  ] as Beat[],
  outcomes: {
    even: {
      id: "even",
      title: "Even",
      description: "Not forgiveness. Not yet. But the truth is finally between you.",
    },
    smoothed: {
      id: "smoothed",
      title: "Smoothed",
      description: "They say it's fine. The untouched drink says otherwise.",
    },
    the_speech: {
      id: "the_speech",
      title: "The Speech",
      description: "You came to apologize. Somehow, they ended up comforting you.",
    },
  } as Record<string, OutcomeDef>,
};
