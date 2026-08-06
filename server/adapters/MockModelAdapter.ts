import type { ModelAdapter } from './ModelAdapter';
import type { ModelOutput, TurnRequest } from '../../src/game/types';
import { SCENARIO } from '../../src/game/scenario';

export type MockMode = 'valid' | 'malformed' | 'error';

function withFinalClosures(
  request: TurnRequest,
  output: ModelOutput
): ModelOutput {
  return request.turnIndex === SCENARIO.totalTurns - 1
    ? { ...output, finalClosures: SCENARIO.fallbackClosures }
    : output;
}

function generateDeterministicOutput(request: TurnRequest): ModelOutput {
  const text = request.playerText.toLowerCase();

  if (/forgive|move on|fine now|say we're okay/.test(text)) {
    return withFinalClosures(request, {
      characterText: "Please don't ask me to make this comfortable for you. I am already trying to manage how you feel about it.",
      perceivedImpact: 'pressure',
      impactReason: 'The request put the burden of relief back on them.',
      engagementDelta: -2,
      tensionDelta: 2,
    });
  }
  if (/not my fault|overreact|big deal|just one|one event|huge thing/.test(text)) {
    return withFinalClosures(request, {
      characterText: 'That makes it sound like my waiting was the problem.',
      perceivedImpact: 'minimization',
      impactReason: 'The harm was reduced instead of recognized.',
      engagementDelta: -2,
      tensionDelta: 2,
    });
  }
  if (/lot going on|stressful|you know how/.test(text)) {
    return withFinalClosures(request, {
      characterText: 'That sounds like another reason I was supposed to understand for you.',
      perceivedImpact: 'defense',
      impactReason: 'The explanation shifted attention away from the broken promise.',
      engagementDelta: -1,
      tensionDelta: 1,
    });
  }
  if (/anyway|how has work|change the subject/.test(text)) {
    return withFinalClosures(request, {
      characterText: "We can talk about work later. You asked me here for this.",
      perceivedImpact: 'avoidance',
      impactReason: 'The subject changed before the hurt was addressed.',
      engagementDelta: -1,
      tensionDelta: 1,
    });
  }
  if (/rebuild|repair|what do you need|next step|differently|respect whatever distance/.test(text)) {
    return withFinalClosures(request, {
      characterText: "I don't know yet. Asking without demanding an answer helps.",
      perceivedImpact: 'repair',
      impactReason: 'The offer left room for their boundary.',
      engagementDelta: 2,
      tensionDelta: -1,
    });
  }
  if (/what hurt|tell me|listen|why were you/.test(text)) {
    return withFinalClosures(request, {
      characterText: 'I kept looking at the door because you said you would be there. Every time it opened, I thought maybe you had changed your mind about leaving me alone in it.',
      perceivedImpact: 'understanding',
      impactReason: 'The question made room for their experience.',
      engagementDelta: 2,
      tensionDelta: -1,
    });
  }
  if (/sorry|hurt you|mattered|let you down|left you/.test(text)) {
    return withFinalClosures(request, {
      characterText: 'That is closer to what I needed you to see.',
      perceivedImpact: 'acknowledgment',
      impactReason: 'The words recognized the effect of the absence.',
      engagementDelta: 2,
      tensionDelta: -1,
    });
  }
  if (/because|happened|reason|panicked|overwhelmed/.test(text)) {
    return withFinalClosures(request, {
      characterText: 'I can hear there was more going on. I still needed the truth.',
      perceivedImpact: 'explanation',
      impactReason: 'The context arrived without erasing what happened.',
      engagementDelta: 1,
      tensionDelta: 0,
    });
  }

  return withFinalClosures(request, {
    characterText: "I'm listening, but I need you to be honest with me.",
    perceivedImpact: 'unclear',
    impactReason: 'Your point is still difficult to place.',
    engagementDelta: 0,
    tensionDelta: 0,
  });
}

export class MockModelAdapter implements ModelAdapter {
  constructor(private readonly mode: MockMode = 'valid') {}

  async generateTurn(request: TurnRequest): Promise<unknown> {
    if (this.mode === 'error') throw new Error('Mock inference failure');
    if (this.mode === 'malformed') return { invalid: true };
    return generateDeterministicOutput(request);
  }
}
