import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import { SCENARIO } from '../src/game/scenario';
import type { PlayerIntent, TurnRequest } from '../src/game/types';

const mode = process.argv[2] === 'recorded' ? 'recorded' : 'mock';
const adapter = mode === 'recorded' ? new RecordedModelAdapter() : new MockModelAdapter();
const messages = ['I am sorry I hurt you.', 'What hurt most?', 'I should have told you the truth.', 'I panicked and then kept avoiding you.', 'What do you need from me now?'];

for (let turnIndex = 0; turnIndex < SCENARIO.totalTurns; turnIndex += 1) {
  const request: TurnRequest = {
    scenarioId: SCENARIO.id,
    turnIndex,
    playerText: messages[turnIndex % messages.length],
    selectedIntention: (turnIndex % 2 ? 'understand' : 'acknowledge') as PlayerIntent,
    state: { ...SCENARIO.startingState },
    recentTranscript: [],
  };
  const output = await adapter.generateTurn(request) as { finalClosures?: unknown };
  if (turnIndex === SCENARIO.totalTurns - 1 && !output.finalClosures) throw new Error('Final closures missing');
}
console.log(`[UNSAID] ${mode} evaluation passed (${SCENARIO.totalTurns} turns)`);
