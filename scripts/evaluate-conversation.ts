import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import { processTurn } from '../server/turn/service';
import { classifyAlignment, evaluateOutcome } from '../src/game/outcome';
import { createNarrativeState } from '../src/game/narrative';
import { SCENARIO } from '../src/game/scenario';
import type { EmotionalState, PlayerIntent, TranscriptEntry, TurnAssessment } from '../src/game/types';

const mode = process.argv[2] === 'recorded' ? 'recorded' : 'mock';
const adapter = mode === 'recorded' ? new RecordedModelAdapter() : new MockModelAdapter();
const paths: Record<string, Array<[PlayerIntent, string]>> = {
  constructive: [['acknowledge','I am sorry I hurt you.'],['understand','Has anything like that happened to you before?'],['acknowledge','You mattered and I let you down.'],['repair','What do you need from me now?'],['explain','I panicked, but that does not excuse the lie.'],['acknowledge','I should have told you the truth.'],['repair','I will respect whatever distance you need.'],['understand','What would honesty look like now?'],['acknowledge','I left you alone and I see that.'],['repair','I want to rebuild this slowly.']],
  mixed: [['explain','I panicked.'],['understand','What hurt most?'],['explain','I had a lot going on.'],['acknowledge','I know that hurt you.'],['understand','Tell me what happened after.'],['explain','I was overwhelmed.'],['explain','There was more going on.'],['understand','Has this changed how you see me?'],['explain','The reason was panic.'],['understand','Are you ready to keep talking?']],
  defensive: Array.from({ length: 10 }, () => ['repair','Can we move on and say we are okay?'] as [PlayerIntent,string]),
  recovery: [['explain','It was not my fault.'],['repair','Can we just move on?'],['acknowledge','I am sorry I hurt you.'],['understand','What hurt most?'],['acknowledge','You mattered and I let you down.'],['repair','What do you need from me?'],['acknowledge','I should have told the truth.'],['understand','Has this changed how you see me?'],['repair','I will respect whatever distance you need.'],['acknowledge','I left you alone, and I see it now.']],
};

for (const [name, turns] of Object.entries(paths)) {
  let state: EmotionalState = { ...SCENARIO.startingState };
  let narrative = createNarrativeState();
  const transcript: TranscriptEntry[] = [{ speaker: 'character', text: SCENARIO.openingLine }];
  const assessments: TurnAssessment[] = [];
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const [selectedIntention, playerText] = turns[turnIndex];
    const response = await processTurn({ scenarioId: SCENARIO.id, turnIndex, playerText, selectedIntention, state, recentTranscript: transcript, narrativeState: narrative }, adapter);
    transcript.push({ speaker: 'player', text: playerText }, { speaker: 'character', text: response.characterText });
    const assessment = { ...response.assessment, selectedIntent: selectedIntention, alignment: classifyAlignment(selectedIntention, response.assessment.perceivedImpact) };
    assessments.push(assessment);
    state = { engagement: Math.max(-10, Math.min(10, state.engagement + assessment.engagementDelta)), tension: Math.max(-10, Math.min(10, state.tension + assessment.tensionDelta)) };
    if (!response.narrative) throw new Error(`${name}: missing narrative metadata`);
    narrative = response.narrative.state;
  }
  const moves = narrative.recentSceneMoves;
  if (moves.some((move, index) => index >= 2 && ['set_boundary','withdraw'].includes(move) && ['set_boundary','withdraw'].includes(moves[index - 1]) && ['set_boundary','withdraw'].includes(moves[index - 2]))) throw new Error(`${name}: repeated withdrawal`);
  if (new Set(narrative.revealedMemoryIds).size !== narrative.revealedMemoryIds.length) throw new Error(`${name}: duplicate memory`);
  if (transcript.some((entry) => /exhibition.*nine years|nine years.*exhibition/i.test(entry.text))) throw new Error(`${name}: chronology merged`);
  const outcome = evaluateOutcome({ assessments, finalEngagement: state.engagement, finalTension: state.tension });
  console.log(`[UNSAID] ${mode} ${name}: ${outcome}, memories=${narrative.revealedMemoryIds.length}, belief=${narrative.activeBelief}`);
}
