import { describe, expect, it } from 'vitest';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { processTurn } from '../server/turn/service';
import { getReflection } from '../src/components/cinematicPresentation';
import { createNarrativeState } from '../src/game/narrative';
import { classifyAlignment, evaluateOutcome } from '../src/game/outcome';
import { SCENARIO } from '../src/game/scenario';
import { applyTurn, derivePortraitState } from '../src/game/state';
import type { PlayerIntent, TranscriptEntry, TurnAssessment } from '../src/game/types';

const HOSTILE_REGRESSION: Array<[PlayerIntent, string]> = [
  ['understand', 'What happened? What did I miss?'],
  ['understand', "What chair? Wait, I don't understand."],
  ['explain', "You're overreacting."],
  ['explain', "It wasn't a big deal."],
  ['acknowledge', "I don't care."],
  ['explain', "You're overreacting."],
  ['repair', 'It was just one event.'],
  ['understand', "What chair? I don't understand."],
  ['acknowledge', "I don't care."],
  ['repair', 'Byeee'],
];

describe('hostile ten-turn regression fixture', () => {
  it('records every accepted turn, protects clarification, and ends Smoothed without comfort evidence', async () => {
    const adapter = new MockModelAdapter();
    let state = { ...SCENARIO.startingState };
    let narrative = createNarrativeState();
    const narrativeHistory = [];
    const assessments: TurnAssessment[] = [];
    const transcript: TranscriptEntry[] = [{ speaker: 'character', text: SCENARIO.openingLine }];

    for (let turnIndex = 0; turnIndex < HOSTILE_REGRESSION.length; turnIndex += 1) {
      const [selectedIntention, playerText] = HOSTILE_REGRESSION[turnIndex];
      const response = await processTurn({
        scenarioId: SCENARIO.id,
        turnIndex,
        playerText,
        selectedIntention,
        state,
        recentTranscript: transcript,
        narrativeState: narrative,
      }, adapter);
      if (!response.narrative) throw new Error('missing narrative record');
      narrative = response.narrative.state;
      narrativeHistory.push(response.narrative.meta);
      assessments.push({
        ...response.assessment,
        selectedIntent: selectedIntention,
        alignment: classifyAlignment(selectedIntention, response.assessment.perceivedImpact),
      });
      transcript.push(
        { speaker: 'player', text: playerText },
        { speaker: 'character', text: response.characterText }
      );
      const next = applyTurn(
        { ...state, portraitState: derivePortraitState(state.engagement, state.tension) },
        response.assessment.engagementDelta,
        response.assessment.tensionDelta
      );
      state = { engagement: next.engagement, tension: next.tension };
    }

    expect(narrativeHistory).toHaveLength(10);
    expect(narrativeHistory.map((record) => record.turnIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(narrativeHistory[0].genuineQuestion).toBe('experience');
    expect(narrativeHistory[1].genuineQuestion).toBe('clarification');
    expect(assessments[1]).toMatchObject({ perceivedImpact: 'understanding' });
    expect(assessments[1].engagementDelta).toBeGreaterThanOrEqual(-1);
    expect(assessments[1].tensionDelta).toBeLessThanOrEqual(1);
    expect(narrative.outcomeEvidence.friendComfortMoveCount).toBe(0);

    const outcome = evaluateOutcome({
      assessments,
      finalEngagement: state.engagement,
      finalTension: state.tension,
      narrativeState: narrative,
    });
    expect(outcome).toBe('smoothed');
    expect(getReflection(assessments, state.engagement, state.tension, outcome)).not.toMatch(/comfort|reassur/i);
  });
});
