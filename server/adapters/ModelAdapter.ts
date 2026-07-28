import { TurnRequest } from '../../src/game/types';

export interface ModelAdapter {
  generateTurn(request: TurnRequest): Promise<unknown>;
}
