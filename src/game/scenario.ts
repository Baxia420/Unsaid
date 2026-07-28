export const SCENARIO = {
  id: "demo",
  title: "Say It Again",
  description: "A difficult café apology with a close friend.",
  startingState: {
    engagement: 0,
    tension: 0,
  },
  bounds: {
    engagement: { min: -10, max: 10 },
    tension: { min: -10, max: 10 },
  },
  deltaBounds: {
    engagementDelta: { min: -3, max: 3 },
    tensionDelta: { min: -3, max: 3 },
  },
  maxPlayerTextLength: 500,
} as const;
