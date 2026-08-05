import { describe, expect, it } from 'vitest';
import { buildOutcomeReflection } from '../src/game/reflection';
import type { TranscriptEntry, TurnAssessment } from '../src/game/types';

const transcript: TranscriptEntry[] = [
  { speaker: 'character', text: 'Opening' },
  { speaker: 'player', text: 'It was not a big deal.' },
  { speaker: 'character', text: 'First response' },
  { speaker: 'player', text: 'I hear that you were waiting.' },
  { speaker: 'character', text: 'Second response' },
];

const assessments: TurnAssessment[] = [
  { intent: 'minimize', engagementDelta: -2, tensionDelta: 2 },
  { intent: 'acknowledge', engagementDelta: 2, tensionDelta: -1 },
];

describe('buildOutcomeReflection', () => {
  it('selects an actual repair-oriented line for Even', () => {
    expect(buildOutcomeReflection('even', transcript, assessments).quote)
      .toBe('I hear that you were waiting.');
  });

  it('selects an actual self-protective line for The Speech', () => {
    expect(buildOutcomeReflection('the_speech', transcript, assessments).quote)
      .toBe('It was not a big deal.');
  });

  it('falls back to the latest real player line when assessments are absent', () => {
    expect(buildOutcomeReflection('smoothed', transcript, []).quote)
      .toBe('I hear that you were waiting.');
  });
});
