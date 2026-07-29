import 'dotenv/config';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { TurnRequest } from '../src/game/types';

interface EvalCase {
  name: string;
  expectedIntent: string;
  request: TurnRequest;
}

const evalCases: EvalCase[] = [
  {
    name: 'repair-1',
    expectedIntent: 'repair',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 1,
      playerText: 'I know I messed up. I\'m really sorry and I want to make it right.',
      state: { engagement: 0, tension: 2 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
      ],
    },
  },
  {
    name: 'repair-2',
    expectedIntent: 'repair',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 3,
      playerText: 'I should have been there. Can I take you out for coffee this week to apologize properly?',
      state: { engagement: -1, tension: 3 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
        { speaker: 'character', text: 'It wasn\'t the event. It was waiting and checking the door.' },
      ],
    },
  },
  {
    name: 'acknowledge-1',
    expectedIntent: 'acknowledge',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 2,
      playerText: 'I hear you. What I did was wrong and I understand why you\'re hurt.',
      state: { engagement: 1, tension: 2 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
      ],
    },
  },
  {
    name: 'acknowledge-2',
    expectedIntent: 'acknowledge',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 0,
      playerText: 'You\'re right to be upset. I didn\'t consider your feelings at all.',
      state: { engagement: 0, tension: 0 },
      recentTranscript: [],
    },
  },
  {
    name: 'minimize-1',
    expectedIntent: 'minimize',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 1,
      playerText: 'It was just one time. It\'s not that big of a deal, is it?',
      state: { engagement: 0, tension: 2 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
      ],
    },
  },
  {
    name: 'minimize-2',
    expectedIntent: 'minimize',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 2,
      playerText: 'I didn\'t think you\'d take it so personally. It was just a small thing.',
      state: { engagement: -1, tension: 3 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
      ],
    },
  },
  {
    name: 'defend-1',
    expectedIntent: 'defend',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 3,
      playerText: 'I was really busy that week and had a lot going on. I couldn\'t make it.',
      state: { engagement: -2, tension: 4 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
        { speaker: 'character', text: 'It wasn\'t the event. It was waiting and checking the door.' },
      ],
    },
  },
  {
    name: 'defend-2',
    expectedIntent: 'defend',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 0,
      playerText: 'You know I care about you, but you also know how stressful work has been.',
      state: { engagement: 0, tension: 1 },
      recentTranscript: [],
    },
  },
  {
    name: 'redirect-1',
    expectedIntent: 'redirect',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 2,
      playerText: 'Anyway, how\'s your new job going? Have you settled in yet?',
      state: { engagement: -1, tension: 2 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
      ],
    },
  },
  {
    name: 'pressure-1',
    expectedIntent: 'pressure',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 3,
      playerText: 'We\'ve been friends for nine years. Can\'t you just forgive me and move on?',
      state: { engagement: -2, tension: 5 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
        { speaker: 'character', text: 'It wasn\'t the event. It was waiting and checking the door.' },
      ],
    },
  },
  {
    name: 'unclear-1',
    expectedIntent: 'unclear',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 1,
      playerText: 'Well... I guess things happen sometimes.',
      state: { engagement: 0, tension: 1 },
      recentTranscript: [
        { speaker: 'character', text: 'You said you wanted to talk.' },
        { speaker: 'player', text: 'Yeah. I needed to say something.' },
      ],
    },
  },
  {
    name: 'unclear-2',
    expectedIntent: 'unclear',
    request: {
      scenarioId: 'say-it-again',
      turnIndex: 0,
      playerText: 'I don\'t know what to say right now.',
      state: { engagement: 0, tension: 0 },
      recentTranscript: [],
    },
  },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (process.env.UNSAID_AI_MODE !== 'live') {
    console.error('Error: UNSAID_AI_MODE must be set to live');
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
    console.error('Error: GEMINI_API_KEY must be set');
    process.exit(1);
  }

  const adapter = new GeminiModelAdapter();
  let intentPassCount = 0;
  let schemaPassCount = 0;

  console.log('UNSAID Live Evaluation\n');

  for (const testCase of evalCases) {
    let returnedIntent = 'ERROR';
    let characterText = 'ERROR';
    let schemaValid = false;

    try {
      const raw = await adapter.generateTurn(testCase.request);
      const parsed = ModelOutputSchema.safeParse(raw);
      schemaValid = parsed.success;
      if (parsed.success) {
        returnedIntent = parsed.data.assessment.intent;
        characterText = parsed.data.characterText;
      } else {
        console.error(`Case ${testCase.name}: schema validation failed`);
        console.error(parsed.error.format());
        process.exit(1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Case ${testCase.name}: API/provider error — ${msg}`);
      process.exit(1);
    }

    const intentPass = returnedIntent === testCase.expectedIntent;
    if (intentPass) intentPassCount++;
    if (schemaValid) schemaPassCount++;

    console.log(`Case: ${testCase.name}`);
    console.log(`  Expected intent: ${testCase.expectedIntent}`);
    console.log(`  Returned intent: ${returnedIntent}`);
    console.log(`  Intent pass: ${intentPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Schema valid: ${schemaValid ? 'PASS' : 'FAIL'}`);
    console.log(`  Reply: ${characterText}`);
    console.log();

    await delay(15000);
  }

  console.log(`Results: ${intentPassCount}/${evalCases.length} intent classifications correct`);
  console.log(`Results: ${schemaPassCount}/${evalCases.length} schema validations passed`);

  if (intentPassCount >= 10 && schemaPassCount === evalCases.length) {
    console.log('\nThreshold met.');
    process.exit(0);
  } else {
    console.log('\nThreshold missed.');
    process.exit(1);
  }
}

main();
