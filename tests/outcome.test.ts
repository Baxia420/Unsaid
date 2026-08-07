import { describe, expect, it } from 'vitest';
import { classifyAlignment, evaluateOutcome, selectOutcomeClosure } from '../src/game/outcome';
import { createNarrativeState, type NarrativeState } from '../src/game/narrative';
import type { PerceivedImpact, TurnAssessment } from '../src/game/types';
import { CLOSURES, makeAssessment } from './helpers';

function sequence(impacts: PerceivedImpact[]): TurnAssessment[] {
  return impacts.map((impact) => makeAssessment(impact));
}

function narrative(overrides: Partial<NarrativeState> = {}): NarrativeState {
  return { ...createNarrativeState(), ...overrides };
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
});

describe('code-owned outcomes', () => {
  it('reaches Even only with constructive state plus a revealed truth and belief movement', () => {
    const state = narrative({
      revealedMemoryIds: ['missed_player'],
      activeBelief: 'repair_might_be_possible',
    });
    expect(evaluateOutcome({
      assessments: sequence([...Array(6).fill('acknowledgment'), ...Array(4).fill('repair')]),
      finalEngagement: 5,
      finalTension: 0,
      narrativeState: state,
    })).toBe('even');
  });

  it('does not award Even from scores or one apology without narrative support', () => {
    expect(evaluateOutcome({
      assessments: sequence(Array(10).fill('repair')),
      finalEngagement: 8,
      finalTension: -2,
      narrativeState: createNarrativeState(),
    })).toBe('smoothed');
  });

  it('reaches The Speech only when guilt or reassurance pressure led to actual comfort', () => {
    const state = narrative({
      outcomeEvidence: {
        playerCenteredGuiltCount: 1,
        reassurancePressureCount: 1,
        friendComfortMoveCount: 1,
      },
    });
    expect(evaluateOutcome({
      assessments: sequence(Array(10).fill('pressure')),
      finalEngagement: -5,
      finalTension: 8,
      narrativeState: state,
    })).toBe('the_speech');
  });

  it('maps repeated minimization and a hostile goodbye to Smoothed when no comfort occurred', () => {
    expect(evaluateOutcome({
      assessments: sequence([...Array(9).fill('minimization'), 'avoidance']),
      finalEngagement: -10,
      finalTension: 10,
      narrativeState: narrative({
        activeBelief: 'they_want_relief',
        outcomeEvidence: {
          playerCenteredGuiltCount: 0,
          reassurancePressureCount: 0,
          friendComfortMoveCount: 0,
        },
      }),
    })).toBe('smoothed');
  });

  it('requires comfort even when the player pressures for reassurance', () => {
    expect(evaluateOutcome({
      assessments: sequence(Array(10).fill('pressure')),
      finalEngagement: -5,
      finalTension: 8,
      narrativeState: narrative({
        outcomeEvidence: {
          playerCenteredGuiltCount: 0,
          reassurancePressureCount: 4,
          friendComfortMoveCount: 0,
        },
      }),
    })).toBe('smoothed');
  });
});

describe('outcome-consistent closing selection', () => {
  it('keeps consistent generated closures', () => {
    expect(selectOutcomeClosure('even', CLOSURES)).toBe(CLOSURES.even);
    expect(selectOutcomeClosure('smoothed', CLOSURES)).toBe(CLOSURES.smoothed);
    expect(selectOutcomeClosure('the_speech', CLOSURES)).toBe(CLOSURES.the_speech);
  });

  it('rejects a non-comforting The Speech closing and false Smoothed reassurance', () => {
    expect(selectOutcomeClosure('the_speech', { ...CLOSURES, the_speech: 'Goodbye.' }))
      .not.toBe('Goodbye.');
    expect(selectOutcomeClosure('smoothed', { ...CLOSURES, smoothed: "We're okay now." }))
      .not.toBe("We're okay now.");
  });
});
