import type { TurnRequest } from '../../src/game/types';
import type { ModelAdapter } from './ModelAdapter';

const REPAIR_WORDS = ['sorry', 'apologize', 'regret', 'should have', 'let you down'];
const ACKNOWLEDGE_WORDS = ['understand', 'hear you', 'mattered', 'waiting', 'hurt you'];
const DEFEND_WORDS = ['not my fault', 'but i', 'you know i', 'could not help'];
const MINIMIZE_WORDS = ['not a big deal', 'just one', 'move on', 'overreact'];
const PRESSURE_WORDS = ['forgive me', 'say it is fine', 'what else', 'how long'];

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

/**
 * A local, deterministic conversation path for demo safety. It performs no
 * network calls and never chooses the final outcome; the game engine still
 * owns progression and ending evaluation.
 */
export class RecordedModelAdapter implements ModelAdapter {
  async generateTurn(request: TurnRequest): Promise<unknown> {
    const text = request.playerText.toLowerCase();

    if (includesAny(text, PRESSURE_WORDS)) {
      return {
        characterText: "I can't make this easier for you just because you want it settled.",
        assessment: { intent: 'pressure', engagementDelta: -1, tensionDelta: 2 },
      };
    }
    if (includesAny(text, MINIMIZE_WORDS)) {
      return {
        characterText: "It may have been one night to you. I was still watching the door.",
        assessment: { intent: 'minimize', engagementDelta: -2, tensionDelta: 2 },
      };
    }
    if (includesAny(text, DEFEND_WORDS)) {
      return {
        characterText: "You're explaining again. I needed you to notice what it cost me.",
        assessment: { intent: 'defend', engagementDelta: -2, tensionDelta: 1 },
      };
    }
    if (includesAny(text, ACKNOWLEDGE_WORDS)) {
      return {
        characterText: "Yes. I kept looking up every time the door opened.",
        assessment: { intent: 'acknowledge', engagementDelta: 2, tensionDelta: -1 },
      };
    }
    if (includesAny(text, REPAIR_WORDS)) {
      return {
        characterText: "I hear the apology. I need to know you understand what you're apologizing for.",
        assessment: { intent: 'repair', engagementDelta: 2, tensionDelta: 0 },
      };
    }

    const neutralLines = [
      "You asked me here. So say what you came to say.",
      "I don't need a perfect speech. I need you to be honest.",
      "The part that hurt was waiting and realizing you weren't coming.",
      "I'm listening. I'm just not going to pretend it didn't matter.",
      "I don't know what happens after this. But at least we're talking about the real thing.",
    ];

    return {
      characterText: neutralLines[Math.min(request.turnIndex, neutralLines.length - 1)],
      assessment: { intent: 'unclear', engagementDelta: 0, tensionDelta: 0 },
    };
  }
}
