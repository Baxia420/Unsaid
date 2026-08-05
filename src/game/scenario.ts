import type { DeltaBounds, FinalClosures, OutcomeDef, StateBounds } from './types';

export const SCENARIO = {
  id: 'say-it-again', title: 'UNSAID', description: 'A difficult café conversation after a broken promise.',
  openingLine: 'You said you wanted to talk.', totalTurns: 15, maxPlayerTextLength: 500,
  startingState: { engagement: -3, tension: 1 },
  bounds: { engagement: { min: -10, max: 10 }, tension: { min: -10, max: 10 } } as StateBounds,
  deltaBounds: { engagementDelta: { min: -3, max: 3 }, tensionDelta: { min: -3, max: 3 } } as DeltaBounds,
  prologue: [
    'You and your closest friend have known each other for nine years.',
    'Three weeks ago, they invited only a few people to an important public event. You promised you would be there.',
    'You did not show up. Later, you said something had come up.',
    'After weeks of silence, you asked to meet at the café.'
  ],
  facts: ['nine-year friendship', 'limited invitation', 'broken promise', 'false excuse', 'waiting at the door', 'three weeks of silence', 'café meeting'],
  fallbackCharacterLine: "I'm trying to understand what you want from this conversation.",
  fallbackClosures: {
    even: "I don't know if we're okay yet. But this is the first time in weeks that this has felt honest.",
    smoothed: "I think it's best if we finish our drinks and leave it here for today.",
    the_speech: "I don't have anything else to give you right now. I think we should go."
  } as FinalClosures,
  outcomes: {
    even: { id: 'even', title: 'Even', description: 'Not forgiveness. Not yet. But the truth is finally between you.' },
    smoothed: { id: 'smoothed', title: 'Smoothed', description: 'They say it is fine. The untouched drink says otherwise.' },
    the_speech: { id: 'the_speech', title: 'The Speech', description: 'You came to apologize. Somehow, they ended up comforting you.' }
  } as Record<string, OutcomeDef>
};
