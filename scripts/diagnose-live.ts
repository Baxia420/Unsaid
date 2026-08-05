import 'dotenv/config';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { SCENARIO } from '../src/game/scenario';
import { getRuntimeMode, getLiveRecovery } from '../server/adapters/factory';
import { categorizeAdapterError } from '../server/turn/service';

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
  let retryAfterSec = '';
  let causeCode = '';
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
    const cat = categorizeAdapterError(error);
    failureCategory = cat.category;
    httpStatus = cat.status !== undefined ? String(cat.status) : '';
    retryAfterSec = cat.retryAfter !== undefined ? String(cat.retryAfter) : '';
    causeCode = cat.causeCode ?? '';

    const extraParts = [
      httpStatus ? `httpStatus=${httpStatus}` : null,
      retryAfterSec ? `retryAfterSec=${retryAfterSec}` : null,
      causeCode ? `causeCode=${causeCode}` : null,
    ].filter(Boolean);
    const extraStr = extraParts.length > 0 ? ` ${extraParts.join(' ')}` : '';

    console.log(`[DIAGNOSE] result=failure category=${failureCategory}${extraStr} latencyMs=${latency}`);
  }

  const summaryParts = [
    `success=${success}`,
    `category=${failureCategory || 'none'}`,
    httpStatus ? `httpStatus=${httpStatus}` : null,
    retryAfterSec ? `retryAfterSec=${retryAfterSec}` : null,
    causeCode ? `causeCode=${causeCode}` : null,
    `schemaValid=${schemaValid}`,
    `relevant=${relevant}`,
  ].filter(Boolean);

  console.log(`[DIAGNOSE] summary: ${summaryParts.join(' ')}`);
  process.exitCode = success ? 0 : 1;
}

main().catch((error) => {
  console.error('[DIAGNOSE] unexpected error:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
});
