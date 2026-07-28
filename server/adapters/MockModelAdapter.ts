import { ModelAdapter } from './ModelAdapter';
import { TurnRequest } from '../../src/game/types';

export type MockMode = "valid" | "malformed" | "error";

export class MockModelAdapter implements ModelAdapter {
  constructor(private mode: MockMode = "valid") {}

  async generateTurn(request: TurnRequest): Promise<unknown> {
    switch (this.mode) {
      case "valid": {
        const text = request.playerText.toLowerCase();
        if (text.includes("sorry") || text.includes("apologize") || text.includes("regret")) {
          return {
            characterText: "I appreciate you saying that. It means more than you know.",
            assessment: { intent: "repair", engagementDelta: 2, tensionDelta: -1 },
          };
        }
        if (text.includes("why") || text.includes("what") || text.includes("how could")) {
          return {
            characterText: "I don't know if I can answer that right now.",
            assessment: { intent: "pressure", engagementDelta: -1, tensionDelta: 2 },
          };
        }
        if (text.includes("understand") || text.includes("listen") || text.includes("hear")) {
          return {
            characterText: "I hear you. I just don't know what to say right now.",
            assessment: { intent: "acknowledge", engagementDelta: 1, tensionDelta: -1 },
          };
        }
        if (text.includes("defend") || text.includes("not my fault") || text.includes("blame")) {
          return {
            characterText: "It feels like you're closing yourself off.",
            assessment: { intent: "defend", engagementDelta: -2, tensionDelta: 1 },
          };
        }
        if (text.includes("space") || text.includes("time") || text.includes("away")) {
          return {
            characterText: "Maybe some distance would be good for both of us.",
            assessment: { intent: "redirect", engagementDelta: -2, tensionDelta: -2 },
          };
        }
        return {
          characterText: "I'm not sure what you're getting at.",
          assessment: { intent: "unclear", engagementDelta: 0, tensionDelta: 0 },
        };
      }
      case "malformed":
        return {
          characterText: "Bad response",
          assessment: {
            intent: "not_a_valid_intent",
            engagementDelta: 100,
            tensionDelta: "should_be_number",
          },
        };
      case "error":
        throw new Error("Mock inference failure");
      default:
        throw new Error(`Unknown mock mode: ${this.mode}`);
    }
  }
}
