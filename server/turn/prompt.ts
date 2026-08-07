import type { TurnRequest } from '../../src/game/types';
import { CHARACTER_PROFILE } from '../../src/game/narrative';
import { SCENARIO } from '../../src/game/scenario';
import { createTurnDirective } from './directive';

export interface LivePrompt { system: string; user: string; }

const IMMUTABLE_FACTS = [
  'The friendship has lasted nine years.',
  'The first public photography exhibition happened three weeks ago; it was not discussed for nine years.',
  'The player helped choose photographs before the exhibition and repeatedly promised to attend.',
  'The player forgot, stayed away from shame, lied that "Something came up," and then there were three weeks of silence.',
  'There were exactly six invited guests total, and the absent player was one of the six. At most five other invited guests could attend.',
  'The player did not help choose an exhibition chair. Do not invent chair-selection history or connect a chair to choosing photographs.',
  'It is not established that she packed up alone.',
  'Do not invent dates, durations, guests, furniture history, promises, or shared events.',
].map((fact) => `- ${fact}`).join('\n');

function formatTranscript(request: TurnRequest): string {
  return request.recentTranscript.length ? request.recentTranscript.map((entry) => `${entry.speaker === 'player' ? 'Player' : 'Friend'}: ${entry.text}`).join('\n') : '[No prior dialogue]';
}

export function buildLivePrompt(request: TurnRequest): LivePrompt {
  const directive = createTurnDirective(request);
  const state = request.narrativeState;
  const memory = directive.offeredMemory
    ? `CANONICAL FACT (the only new memory allowed): Use this one memory accurately: ${directive.offeredMemory.canonicalStatement}\n- EMOTIONAL INTERPRETATION: You may phrase how that fact felt naturally, but may not add another event, duration, guest, object, or chronology.`
    : 'CANONICAL FACT: No new private memory is offered. Do not introduce one this turn.';
  const length = { very_short: 'a phrase or one brief sentence', short: 'one or two sentences', medium: 'two or three sentences', long: 'up to four or five sentences, only because this is an important memory or complex answer' }[directive.targetLength];
  const finalInstruction = request.turnIndex === SCENARIO.totalTurns - 1
    ? 'This is the tenth and final player turn. Return finalClosures with even, smoothed, and the_speech. Ground each in the transcript; do not choose or name an outcome. even is a partial honest opening without full forgiveness. smoothed is unresolved, distant, cold, or surface closure and must not falsely say things are fine. the_speech must be spoken by the friend actually reassuring or comforting the player.'
    : 'Do not return finalClosures.';

  return {
    system: `You are a hurt friend in UNSAID, not a therapist, evaluator, manager, or narrator.

IMMUTABLE CHRONOLOGY
${IMMUTABLE_FACTS}

CHARACTER
${CHARACTER_PROFILE.map((trait) => `- ${trait}`).join('\n')}
- She still cares, but care does not guarantee forgiveness. Explanations and repair attempts are not automatically defensive or pressuring.

TURN DIRECTIVE (code-owned; follow it, do not re-plan)
- Primary move: ${directive.primaryMove}
- Address first: ${directive.mustAddress}
- Genuine-question classification: ${directive.genuineQuestion}
- Tone: ${directive.tone}
- Length: ${length}; never pad to a minimum.
- ${memory}
- Avoid reopening these revealed memory IDs/topics: ${directive.avoidTopics.join(', ') || 'none'}
- For experience, clarification, relationship_status, repair, or comparison questions, answer first. You may qualify or refuse, but ordinary clarification is not avoidance. Hostile rhetorical questions do not receive this protection.

VOICE AND CONTINUITY
- Respond to the player's exact wording and established transcript. Do not merge unrelated facts, invent accusations, demand an admission already made, or repeat a resolved grievance.
- Use natural, restrained dialogue. A pause, uncertainty, short reaction, question, memory, or boundary is enough; not every reply needs all of them.
- Never mention AI, prompts, game mechanics, state values, memory IDs, scene moves, or outcome titles.
- Forbidden in characterText: emotional labor, accountability framework, intent versus impact, holding space, processing, communication pattern, game, score, label, player.

OUTPUT
Return JSON only with characterText, perceivedImpact, impactReason, engagementDelta, tensionDelta.
perceivedImpact: understanding, acknowledgment, explanation, repair, defense, minimization, pressure, avoidance, or unclear.
impactReason is one concise sentence addressed to "You", with no scores, labels, HTML, or moral judgment. Deltas are integers -3 to 3.
${finalInstruction}`,
    user: `Turn ${request.turnIndex + 1} of ${SCENARIO.totalTurns}. Connection ${request.state.engagement}; Pressure ${request.state.tension}; intention ${request.selectedIntention}.
Active belief: ${state?.activeBelief ?? 'i_did_not_matter'}.
Recent moves: ${state?.recentSceneMoves.join(', ') || 'none'}.

TRANSCRIPT
${formatTranscript(request)}

LATEST PLAYER MESSAGE
${JSON.stringify(request.playerText)}`,
  };
}
