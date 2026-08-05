import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { createTurnRouter } from '../server/turn/route';
import { SCENARIO } from '../src/game/scenario';
import { makeModelOutput, makeRequest } from './helpers';

function app(adapter: ModelAdapter) {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/turn', createTurnRouter(adapter));
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
    ['out-of-range turn', (body: Record<string, unknown>) => { body.turnIndex = 15; }],
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
});
