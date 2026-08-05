import 'dotenv/config';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { SCENARIO } from '../src/game/scenario';
import { getRuntimeMode, getLiveRecovery } from '../server/adapters/factory';

async function main() {
  const mode = getRuntimeMode();
  const recovery = getLiveRecovery();
  const keyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

  console.log(`[DIAGNOSE] mode=${mode} model=${model} keyConfigured=${keyConfigured} liveRecovery=${recovery}`);

  if (mode !== 'live') {
    console.log('[DIAGNOSE] SKIP: not in live mode');
    process.exitCode = 0;
    return;
  }

  if (!keyConfigured) {
    console.log('[DIAGNOSE] SKIP: no API key configured');
    process.exitCode = 0;
    return;
  }

  const adapter = new GeminiModelAdapter();
  const request = {
    scenarioId: SCENARIO.id,
    turnIndex: 0,
    playerText: 'I lied because I was embarrassed that I forgot until the event had already started.',
    selectedIntention: 'acknowledge' as const,
    state: { ...SCENARIO.startingState },
    recentTranscript: [{ speaker: 'character' as const, text: SCENARIO.openingLine }],
  };

  const start = Date.now();
  let success = false;
  let failureCategory = '';
  let httpStatus = '';
  let schemaValid = false;
  let relevant = false;

  try {
    const raw = await adapter.generateTurn(request);
    const latency = Date.now() - start;
    const parsed = ModelOutputSchema.safeParse(raw);
    schemaValid = parsed.success;

    if (parsed.success) {
      const text = parsed.data.characterText.toLowerCase();
      const hasRelevance = /embarrass|forget|forgot|event|started|lying|honest|truth|late|ashamed/.test(text);
      const hasSystemTerms = /\b(ai|prompt|score|outcome|game mechanic|label)\b/i.test(parsed.data.characterText);
      relevant = hasRelevance && !hasSystemTerms;
      success = relevant && parsed.data.characterText.length > 0;
      console.log(`[DIAGNOSE] result=success latencyMs=${latency} schemaValid=true relevant=${relevant}`);
      console.log(`[DIAGNOSE] characterTextPreview=${parsed.data.characterText.slice(0, 120)}`);
    } else {
      success = false;
      failureCategory = 'SCHEMA_INVALID';
      console.log(`[DIAGNOSE] result=failure category=SCHEMA_INVALID latencyMs=${latency}`);
    }
  } catch (error) {
    const latency = Date.now() - start;
    if (error && typeof error === 'object' && 'status' in error) {
      httpStatus = String((error as { status: number }).status);
      failureCategory = `HTTP_${httpStatus}`;
    } else if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('timed out') || msg.includes('timeout')) failureCategory = 'TIMEOUT';
      else if (msg.includes('network') || msg.includes('fetch failed')) failureCategory = 'NETWORK_ERROR';
      else if (msg.includes('invalid json')) failureCategory = 'INVALID_JSON';
      else if (msg.includes('empty content')) failureCategory = 'EMPTY_CONTENT';
      else failureCategory = 'UNKNOWN_PROVIDER_ERROR';
    }
    console.log(`[DIAGNOSE] result=failure category=${failureCategory} httpStatus=${httpStatus} latencyMs=${latency}`);
  }

  console.log(`[DIAGNOSE] summary: success=${success} category=${failureCategory || 'none'} schemaValid=${schemaValid} relevant=${relevant}`);
  process.exitCode = success ? 0 : 1;
}

main().catch((error) => {
  console.error('[DIAGNOSE] unexpected error:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
});
