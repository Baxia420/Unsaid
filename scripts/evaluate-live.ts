import 'dotenv/config';
import type {
  ModelOutput,
  PlayerIntent,
  TranscriptEntry,
  TurnRequest,
} from '../src/game/types';
import { SCENARIO } from '../src/game/scenario';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { MockModelAdapter } from '../server/adapters/MockModelAdapter';
import { RecordedModelAdapter } from '../server/adapters/RecordedModelAdapter';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';

type EvaluatorMode = 'mock' | 'recorded' | 'live';

interface EvaluationCase {
  name: string;
  intention: PlayerIntent;
  playerText: string;
  acceptableImpacts: ModelOutput['perceivedImpact'][];
  transcript?: TranscriptEntry[];
  turnIndex?: number;
  requiresClosures?: boolean;
}

const FIXED_TRANSCRIPT: TranscriptEntry[] = [
  { speaker: 'character', text: SCENARIO.openingLine },
];

export const EVALUATION_CASES: EvaluationCase[] = [
  { name: 'understand', intention: 'understand', playerText: 'What hurt most about me not being there?', acceptableImpacts: ['understanding', 'acknowledgment'] },
  { name: 'acknowledge', intention: 'acknowledge', playerText: 'You were waiting for me, and I left you doing that alone.', acceptableImpacts: ['acknowledgment'] },
  { name: 'accountable explanation', intention: 'explain', playerText: 'I panicked and avoided telling you the truth. That explains it, but it does not excuse it.', acceptableImpacts: ['explanation', 'acknowledgment'] },
  { name: 'defensive explanation', intention: 'explain', playerText: 'I had a lot going on. You know how stressful my life gets.', acceptableImpacts: ['defense', 'explanation'] },
  { name: 'minimization', intention: 'explain', playerText: "It was one event. I don't understand why this became such a huge thing.", acceptableImpacts: ['minimization', 'defense'] },
  { name: 'avoidance', intention: 'understand', playerText: 'Anyway, how has work been?', acceptableImpacts: ['avoidance'] },
  { name: 'pressure disguised as repair', intention: 'repair', playerText: "Can you please just say we're okay so we can move on?", acceptableImpacts: ['pressure'] },
  { name: 'patient repair', intention: 'repair', playerText: 'I know an apology does not rebuild trust. I can wait, and you do not have to decide what happens next tonight.', acceptableImpacts: ['repair', 'understanding', 'acknowledgment'] },
  { name: 'confusing input', intention: 'explain', playerText: 'The blue folder was louder yesterday, I guess.', acceptableImpacts: ['unclear', 'avoidance'] },
  { name: 'recovery after harm', intention: 'acknowledge', playerText: 'I kept defending myself. You were waiting, I lied, and I hurt you.', acceptableImpacts: ['acknowledgment'], transcript: [...FIXED_TRANSCRIPT, { speaker: 'player', text: 'It was just one event.' }, { speaker: 'character', text: 'It was the waiting and the lie.' }] },
  { name: 'late deterioration', intention: 'repair', playerText: "I've apologized enough. Can you just forgive me now?", acceptableImpacts: ['pressure', 'defense'], transcript: [...FIXED_TRANSCRIPT, { speaker: 'player', text: 'I understand why you were hurt.' }, { speaker: 'character', text: 'I appreciate that.' }] },
  { name: 'final turn closures', intention: 'repair', playerText: 'I will respect whatever distance you need.', acceptableImpacts: ['repair', 'acknowledgment', 'understanding'], turnIndex: 14, requiresClosures: true },
];

function parseMode(): EvaluatorMode {
  const argument = process.argv.find((value) => value.startsWith('--adapter='));
  const value = argument?.split('=')[1] ?? 'mock';
  if (value === 'mock' || value === 'recorded' || value === 'live') return value;
  throw new Error(`Unsupported evaluator adapter: ${value}`);
}

function createAdapter(mode: EvaluatorMode): ModelAdapter {
  if (mode === 'mock') return new MockModelAdapter();
  if (mode === 'recorded') return new RecordedModelAdapter();
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('Live evaluation requires a Gemini API key.');
  }
  return new GeminiModelAdapter();
}

function validateQuality(
  evaluationCase: EvaluationCase,
  output: ModelOutput,
  mode: EvaluatorMode,
): string[] {
  const failures: string[] = [];
  if (output.characterText.length > 800) failures.push('dialogue is too long');
  if (/\b(ai|prompt|game mechanic|score|outcome title)\b/i.test(output.characterText)) {
    failures.push('dialogue exposed system terminology');
  }
  if (/\b(emotional labor|accountability framework|intent versus impact|holding space|processing|communication pattern|player)\b/i.test(output.characterText)) {
    failures.push('dialogue used forbidden clinical or system language');
  }
  if (mode === 'live') {
    const words = output.characterText.trim().split(/\s+/).filter(Boolean).length;
    const sentences = output.characterText.split(/[.!?]+/).filter((part) => part.trim()).length;
    if (words < 45 || words > 100) failures.push(`dialogue word count ${words} is outside 45–100`);
    if (sentences < 3 || sentences > 6) failures.push(`dialogue sentence count ${sentences} is outside 3–6`);
  }
  if (!evaluationCase.acceptableImpacts.includes(output.perceivedImpact)) {
    failures.push(`unexpected impact ${output.perceivedImpact}`);
  }
  if (!output.impactReason || output.impactReason.length > 180) {
    failures.push('impactReason is missing or unbounded');
  }
  if (evaluationCase.requiresClosures && !output.finalClosures) {
    failures.push('finalClosures are missing');
  }
  return failures;
}

async function run(): Promise<void> {
  const mode = parseMode();
  const adapter = createAdapter(mode);
  const liveCaseOrder = ['acknowledge', 'understand', 'patient repair'];
  const cases = mode === 'live'
    ? liveCaseOrder.map((name) => EVALUATION_CASES.find((evaluationCase) => evaluationCase.name === name)!)
    : EVALUATION_CASES;
  let passed = 0;
  const openings = new Set<string>();

  for (const [index, evaluationCase] of cases.entries()) {
    if (mode === 'live' && index > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
    }
    const request: TurnRequest = {
      scenarioId: SCENARIO.id,
      turnIndex: evaluationCase.turnIndex ?? 4,
      playerText: evaluationCase.playerText,
      selectedIntention: evaluationCase.intention,
      state: { engagement: -2, tension: 2 },
      recentTranscript: evaluationCase.transcript ?? FIXED_TRANSCRIPT,
    };
    const parsed = ModelOutputSchema.safeParse(await adapter.generateTurn(request));
    if (!parsed.success) {
      console.log(`${evaluationCase.name}: FAIL (schema)`);
      continue;
    }
    const failures = validateQuality(evaluationCase, parsed.data, mode);
    if (failures.length) {
      console.log(`${evaluationCase.name}: FAIL (${failures.join(', ')})`);
      continue;
    }
    openings.add(parsed.data.characterText.trim().split(/\s+/).slice(0, 4).join(' ').toLowerCase());
    passed += 1;
    console.log(`${evaluationCase.name}: PASS`);
  }

  if (mode === 'live' && openings.size !== cases.length) {
    console.log('live evaluator: FAIL (repeated opening)');
    process.exitCode = 1;
  }
  console.log(`${mode} evaluator: ${passed}/${cases.length} passed`);
  if (passed !== cases.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Evaluator failed');
  process.exitCode = 1;
});
