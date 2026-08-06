import { describe, expect, it } from 'vitest';
import { classifyAlignment, evaluateOutcome } from '../src/game/outcome';
import type { PerceivedImpact, TurnAssessment } from '../src/game/types';
import { makeAssessment } from './helpers';

function sequence(impacts: PerceivedImpact[]): TurnAssessment[] {
  return impacts.map((impact) => makeAssessment(impact));
}

describe('alignment classification', () => {
  it.each([
    ['understand', 'understanding'], ['acknowledge', 'acknowledgment'],
    ['explain', 'explanation'], ['repair', 'repair'],
  ] as const)('aligns %s with %s', (intention, impact) => {
    expect(classifyAlignment(intention, impact)).toBe('aligned');
  });
  it.each(['defense', 'minimization', 'pressure', 'avoidance'] as const)(
    'classifies %s as harmful divergence',
    (impact) => expect(classifyAlignment('repair', impact)).toBe('harmful_divergence')
  );
  it.each(['understanding', 'acknowledgment', 'explanation', 'repair', 'unclear'] as const)(
    'keeps nonmatching constructive/neutral impact %s non-harmful',
    (impact) => {
      if (impact !== 'repair') expect(classifyAlignment('repair', impact)).toBe('constructive_divergence');
    }
  );
});

describe('code-owned outcomes', () => {
  it.each([
    [Array(10).fill('repair')],
    [[...Array(5).fill('understanding'), ...Array(5).fill('acknowledgment'), ...Array(5).fill('repair')]],
  ] as [PerceivedImpact[]][])('reaches Even through sustained constructive patterns', (impacts) => {
    expect(evaluateOutcome({ assessments: sequence(impacts), finalEngagement: 5, finalTension: 0 })).toBe('even');
  });
  it.each([
    [Array(10).fill('pressure')],
    [[...Array(7).fill('defense'), ...Array(8).fill('minimization')]],
  ] as [PerceivedImpact[]][])('reaches The Speech through harmful patterns', (impacts) => {
    expect(evaluateOutcome({ assessments: sequence(impacts), finalEngagement: -5, finalTension: 8 })).toBe('the_speech');
  });
  it.each([
    [Array(10).fill('unclear')],
    [[...Array(7).fill('explanation'), ...Array(8).fill('unclear')]],
  ] as [PerceivedImpact[]][])('reaches Smoothed through unresolved patterns', (impacts) => {
    expect(evaluateOutcome({ assessments: sequence(impacts), finalEngagement: 0, finalTension: 1 })).toBe('smoothed');
  });
  it('allows meaningful recovery after early mistakes', () => {
    const impacts = [...Array(2).fill('defense'), ...Array(4).fill('acknowledgment'), ...Array(4).fill('repair')] as PerceivedImpact[];
    expect(evaluateOutcome({ assessments: sequence(impacts), finalEngagement: 6, finalTension: 1 })).toBe('even');
  });
  it('lets late harm damage an otherwise constructive run', () => {
    const impacts = [...Array(6).fill('repair'), 'pressure', 'defense', 'minimization', 'pressure'] as PerceivedImpact[];
    expect(evaluateOutcome({ assessments: sequence(impacts), finalEngagement: 2, finalTension: 6 })).toBe('the_speech');
  });
  it('does not let one final line determine the whole outcome', () => {
    const impacts = [...Array(9).fill('pressure'), 'repair'] as PerceivedImpact[];
    expect(evaluateOutcome({ assessments: sequence(impacts), finalEngagement: -4, finalTension: 8 })).toBe('the_speech');
  });
  it('uses emotional state deterministically', () => {
    const assessments = sequence(Array(10).fill('unclear'));
    expect(evaluateOutcome({ assessments, finalEngagement: -3, finalTension: 8 })).toBe('the_speech');
    expect(evaluateOutcome({ assessments, finalEngagement: 0, finalTension: 0 })).toBe('smoothed');
  });
});
