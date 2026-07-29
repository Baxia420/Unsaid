import { describe, it, expect } from 'vitest';
import { evaluateOutcome } from '../src/game/outcome';
import type { Intent } from '../src/game/types';

describe('evaluateOutcome', () => {
  it('returns even when at least 3 repair-oriented, positive engagement, and tension not highly elevated', () => {
    const result = evaluateOutcome({
      intents: ['repair', 'repair', 'acknowledge', 'repair', 'acknowledge'] as Intent[],
      finalEngagement: 8,
      finalTension: -3,
    });
    expect(result).toBe('even');
  });

  it('returns the_speech when at least 3 self-protective turns', () => {
    const result = evaluateOutcome({
      intents: ['defend', 'pressure', 'minimize', 'defend', 'unclear'] as Intent[],
      finalEngagement: -5,
      finalTension: 7,
    });
    expect(result).toBe('the_speech');
  });

  it('returns the_speech when highly tense and non-engaged regardless of intent mix', () => {
    const result = evaluateOutcome({
      intents: ['repair', 'unclear', 'unclear', 'unclear', 'unclear'] as Intent[],
      finalEngagement: 0,
      finalTension: 5,
    });
    expect(result).toBe('the_speech');
  });

  it('returns smoothed for mixed paths that do not meet even or the_speech', () => {
    const result = evaluateOutcome({
      intents: ['repair', 'repair', 'pressure', 'pressure', 'unclear'] as Intent[],
      finalEngagement: 2,
      finalTension: 2,
    });
    expect(result).toBe('smoothed');
  });

  it('returns smoothed when repair count is high but tension is highly elevated', () => {
    const result = evaluateOutcome({
      intents: ['repair', 'repair', 'repair', 'acknowledge', 'unclear'] as Intent[],
      finalEngagement: 2,
      finalTension: 5,
    });
    expect(result).toBe('smoothed');
  });

  it('returns smoothed when repair count is high but engagement is not positive', () => {
    const result = evaluateOutcome({
      intents: ['repair', 'repair', 'repair', 'acknowledge', 'unclear'] as Intent[],
      finalEngagement: 0,
      finalTension: 2,
    });
    expect(result).toBe('smoothed');
  });
});
