import { describe, expect, it } from 'vitest';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import { processTurn } from '../server/turn/service';
import { applyTurn, derivePortraitState } from '../src/game/state';
import { classifyAlignment, evaluateOutcome } from '../src/game/outcome';
import { SCENARIO } from '../src/game/scenario';
import type {
  PlayerIntent,
  TranscriptEntry,
  TurnAssessment,
} from '../src/game/types';

const ROUTE: Array<{ intention: PlayerIntent; text: string }> = [
  { intention: 'understand', text: 'What hurt most?' },
  { intention: 'acknowledge', text: 'I am sorry I hurt you.' },
  { intention: 'explain', text: 'I panicked because I was overwhelmed.' },
  { intention: 'repair', text: 'What would I need to do differently?' },
];

async function completeRun(adapter: ModelAdapter) {
  let emotionalState = { ...SCENARIO.startingState };
  let transcript: TranscriptEntry[] = [
    { speaker: 'character', text: SCENARIO.openingLine },
  ];
  const assessments: TurnAssessment[] = [];
  let finalClosures = undefined;

  for (let turnIndex = 0; turnIndex < SCENARIO.totalTurns; turnIndex += 1) {
    const route = ROUTE[turnIndex % ROUTE.length];
    const response = await processTurn(
      {
        scenarioId: SCENARIO.id,
        turnIndex,
        playerText: route.text,
        selectedIntention: route.intention,
        state: emotionalState,
        recentTranscript: transcript,
      },
      adapter
    );
    const nextState = applyTurn(
      {
        ...emotionalState,
        portraitState: derivePortraitState(
          emotionalState.engagement,
          emotionalState.tension
        ),
      },
      response.assessment.engagementDelta,
      response.assessment.tensionDelta
    );
    emotionalState = {
      engagement: nextState.engagement,
      tension: nextState.tension,
    };
    assessments.push({
      ...response.assessment,
      selectedIntent: route.intention,
      alignment: classifyAlignment(
        route.intention,
        response.assessment.perceivedImpact
      ),
    });
    transcript = [
      ...transcript,
      { speaker: 'player', text: route.text },
      { speaker: 'character', text: response.characterText },
    ];
    finalClosures = response.finalClosures;
  }

  return {
    assessments,
    emotionalState,
    transcript,
    finalClosures,
    outcome: evaluateOutcome({
      assessments,
      finalEngagement: emotionalState.engagement,
      finalTension: emotionalState.tension,
    }),
  };
}

describe('complete deterministic runs', () => {
  it.each([
    ['mock', new MockModelAdapter()],
    ['recorded', new RecordedModelAdapter()],
  ] as const)('completes a 10-turn %s run with one response per turn', async (_name, adapter) => {
    const result = await completeRun(adapter);
    expect(result.transcript.filter((entry) => entry.speaker === 'player')).toHaveLength(10);
    expect(result.transcript.filter((entry) => entry.speaker === 'character')).toHaveLength(11);
    expect(result.assessments).toHaveLength(10);
    expect(result.finalClosures).toBeDefined();
    expect(['even', 'smoothed', 'the_speech']).toContain(result.outcome);
  });
});
