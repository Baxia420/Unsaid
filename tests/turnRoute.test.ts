import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { createTurnRouter } from '../server/turn/route';
import { SCENARIO } from '../src/game/scenario';
import { makeModelOutput, makeRequest } from './helpers';

function app(adapter: ModelAdapter, recoveryAdapter?: ModelAdapter, strictLive?: boolean) {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/turn', createTurnRouter(adapter, recoveryAdapter, { strictLive }));
  return instance;
}

const validAdapter: ModelAdapter = { generateTurn: vi.fn(async () => makeModelOutput()) };

describe('turn route validation', () => {
  it('accepts a valid dynamic request', async () => {
    const response = await request(app(validAdapter)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(200);
    expect(response.body.assessment.perceivedImpact).toBe('understanding');
  });
  it.each([
    ['missing intention', (body: Record<string, unknown>) => delete body.selectedIntention],
    ['invalid intention', (body: Record<string, unknown>) => { body.selectedIntention = 'defend'; }],
    ['invalid scenario', (body: Record<string, unknown>) => { body.scenarioId = 'other'; }],
    ['out-of-range turn', (body: Record<string, unknown>) => { body.turnIndex = 10; }],
    ['oversized input', (body: Record<string, unknown>) => { body.playerText = 'x'.repeat(SCENARIO.maxPlayerTextLength + 1); }],
    ['malformed state', (body: Record<string, unknown>) => { body.state = { engagement: 'bad', tension: 0 }; }],
    ['malformed transcript', (body: Record<string, unknown>) => { body.recentTranscript = [{ speaker: 'other', text: '' }]; }],
  ])('rejects %s', async (_name, mutate) => {
    const body = { ...makeRequest() } as unknown as Record<string, unknown>;
    mutate(body);
    const response = await request(app(validAdapter)).post('/api/turn').send(body);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request');
  });
  it('returns sanitized validation errors', async () => {
    const response = await request(app(validAdapter)).post('/api/turn').send({ apiKey: 'secret-key' });
    expect(JSON.stringify(response.body)).not.toContain('secret-key');
    expect(response.body.details).toBeInstanceOf(Array);
  });
  it('does not return provider secrets after an adapter failure', async () => {
    const failing: ModelAdapter = { generateTurn: vi.fn(async () => { throw new Error('secret-key'); }) };
    const response = await request(app(failing)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('secret-key');
  });
  it('returns 503 for strict live provider failure', async () => {
    const failing: ModelAdapter = { generateTurn: vi.fn(async () => { throw new Error('provider down'); }) };
    const response = await request(app(failing, undefined, true)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('The conversation service is temporarily unavailable. Please retry.');
  });
  it('returns 503 for strict live schema failure', async () => {
    const badSchema: ModelAdapter = { generateTurn: vi.fn(async () => ({ invalid: true })) };
    const response = await request(app(badSchema, undefined, true)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('The conversation service is temporarily unavailable. Please retry.');
  });
  it('sets source headers without credentials', async () => {
    const response = await request(app(validAdapter)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(200);
    expect(response.headers['x-unsaid-turn-source']).toBeDefined();
    expect(response.headers['x-unsaid-recovery-used']).toBeDefined();
    expect(response.headers['x-unsaid-turn-source']).not.toContain('key');
    expect(response.headers['x-unsaid-turn-source']).not.toContain('secret');
  });
  it('per-turn diagnostics never print the key', async () => {
    const failing: ModelAdapter = { generateTurn: vi.fn(async () => { throw new Error('secret-key'); }) };
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await request(app(failing)).post('/api/turn').send(makeRequest());
    const output = log.mock.calls.flat().join(' ');
    expect(output).not.toContain('secret-key');
    expect(output).toContain('[UNSAID]');
  });
  it('allows recorded recovery in non-strict mode even when primary fails', async () => {
    const failing: ModelAdapter = { generateTurn: vi.fn(async () => { throw new Error('provider down'); }) };
    const recovery: ModelAdapter = { generateTurn: vi.fn(async () => makeModelOutput({ characterText: 'Recovered.' })) };
    const response = await request(app(failing, recovery)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(200);
    expect(response.body.characterText).toBe('Recovered.');
    expect(response.headers['x-unsaid-recovery-used']).toBe('true');
  });
  it('falls back to deterministic output when no recovery is available', async () => {
    const failing: ModelAdapter = { generateTurn: vi.fn(async () => { throw new Error('provider down'); }) };
    const response = await request(app(failing)).post('/api/turn').send(makeRequest());
    expect(response.status).toBe(200);
    expect(response.body.characterText).toBe(SCENARIO.fallbackCharacterLine);
    expect(response.headers['x-unsaid-recovery-used']).toBe('false');
  });
});
