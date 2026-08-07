import { TurnRequest } from '../../src/game/types.js';

export interface ModelAdapter {
  generateTurn(request: TurnRequest): Promise<unknown>;
}
