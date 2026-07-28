import { ModelAdapter } from './ModelAdapter';
import { TurnRequest } from '../../src/game/types';

export type MockMode = "valid" | "malformed" | "error";

export class MockModelAdapter implements ModelAdapter {
  constructor(private mode: MockMode = "valid") {}

  async generateTurn(_request: TurnRequest): Promise<unknown> {
    switch (this.mode) {
      case "valid":
        return {
          characterText: "I hear you. I just don't know what to say right now.",
          assessment: {
            intent: "acknowledge",
            engagementDelta: 1,
            tensionDelta: -1,
          },
        };
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
