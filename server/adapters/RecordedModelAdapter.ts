import type { ModelAdapter } from './ModelAdapter.ts';
import type { TurnRequest } from '../../src/game/types.ts';
import { MockModelAdapter } from './MockModelAdapter.ts';

/**
 * Deterministic demo-safe adapter. It owns no mutable run state and performs
 * no network activity, so independent runs cannot leak into one another.
 */
export class RecordedModelAdapter implements ModelAdapter {
  private readonly deterministicAdapter = new MockModelAdapter();

  generateTurn(request: TurnRequest): Promise<unknown> {
    return this.deterministicAdapter.generateTurn(request);
  }
}
