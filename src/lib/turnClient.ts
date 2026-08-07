import { TurnRequest, TurnResponse } from '../game/types';

export class TurnClientError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly retryable = true
  ) {
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
    let payload: { error?: string; code?: string; retryable?: boolean } | null = null;
    try {
      payload = await response.json() as { error?: string; code?: string; retryable?: boolean };
    } catch {
      // Use the sanitized status fallback below.
    }
    throw new TurnClientError(
      payload?.error ?? `Server error: ${response.status}. Please try again.`,
      payload?.code,
      payload?.retryable ?? response.status >= 500
    );
  }

  try {
    const result = (await response.json()) as TurnResponse;
    if (result.narrative) {
      const providerSource = response.headers.get('X-Unsaid-Turn-Source');
      if (providerSource) result.narrative.meta.providerSource = providerSource;
      const latencyHeader = response.headers.get('X-Unsaid-Latency-Ms');
      const latency = latencyHeader === null ? Number.NaN : Number(latencyHeader);
      if (Number.isFinite(latency)) result.narrative.meta.latencyMs = latency;
    }
    return result;
  } catch {
    throw new TurnClientError('Invalid response from server. Please try again.');
  }
}
