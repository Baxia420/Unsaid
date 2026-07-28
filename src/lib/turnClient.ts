import { TurnRequest, TurnResponse } from '../game/types';

export class TurnClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnClientError';
  }
}

export async function postTurn(request: TurnRequest): Promise<TurnResponse> {
  let response: Response;
  try {
    response = await fetch('/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new TurnClientError('Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    throw new TurnClientError(`Server error: ${response.status}. Please try again.`);
  }

  try {
    return (await response.json()) as TurnResponse;
  } catch {
    throw new TurnClientError('Invalid response from server. Please try again.');
  }
}
