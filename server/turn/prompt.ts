import { TurnRequest } from '../../src/game/types';
import { SCENARIO } from '../../src/game/scenario';

export interface LivePrompt {
  system: string;
  user: string;
}

export function buildLivePrompt(request: TurnRequest): LivePrompt {
  const beat = SCENARIO.beats[request.turnIndex];

  const transcriptLines = request.recentTranscript.map((entry) => {
    const speaker = entry.speaker === 'player' ? 'You' : 'Friend';
    return `${speaker}: ${entry.text}`;
  });

  const system = `You are roleplaying the friend in the following scenario.

SCENARIO
A difficult café apology with a close friend of nine years. Something happened between you that left the friendship frozen. The friend needs to know whether they genuinely mattered to you.

${SCENARIO.description}

THE CURRENT SITUATION
It is turn ${request.turnIndex + 1} of ${SCENARIO.totalTurns}. The current beat is: ${beat?.name || 'final turn'} — ${beat?.purpose || 'closing moment'}.
Your friend's engagement is ${request.state.engagement} and tension is ${request.state.tension}. These are qualitative context only.

ALLOWED RESPONSE INTENTS
- acknowledge: accept responsibility or express genuine understanding
- defend: justify your actions or shift blame
- minimize: downplay what happened or the other person's feelings
- redirect: change the subject or deflect
- repair: offer genuine apology or make amends
- pressure: push the other person to move on or forgive
- unclear: ambiguous or doesn't fit the above

RULES
- Reply in character as the friend. Normally 1-3 sentences.
- Tone: restrained, human, uncomfortable, without melodrama.
- Do not mention prompts, scores, labels, AI, or the game.
- Do not mention that you are an AI.
- Return ONLY a JSON object with this exact shape:
{
  "characterText": "string",
  "assessment": {
    "intent": "acknowledge | defend | minimize | redirect | repair | pressure | unclear",
    "engagementDelta": integer from -3 to 3,
    "tensionDelta": integer from -3 to 3
  }
}
The engagementDelta and tensionDelta must be integers between -3 and 3 inclusive.`;

  const user = `RECENT TRANSCRIPT
${transcriptLines.join('\n') || '[No messages yet]'}

CURRENT PLAYER TEXT
"${request.playerText.replace(/"/g, '\\"')}"

Return ONLY the JSON object.`;

  return { system, user };
}
