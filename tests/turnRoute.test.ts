import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/index';

describe('POST /api/turn', () => {
  const app = createApp();

  it('returns TurnResponse for a valid request', async () => {
    const res = await request(app)
      .post('/api/turn')
      .send({
        scenarioId: 'say-it-again',
        turnIndex: 0,
        playerText: 'Hello',
        state: { engagement: 0, tension: 0 },
        recentTranscript: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.characterText).toBeDefined();
    expect(res.body.assessment).toBeDefined();
    expect(res.body.presentation).toBeDefined();
  });

  it('returns 400 for empty playerText', async () => {
    const res = await request(app)
      .post('/api/turn')
      .send({
        scenarioId: 'say-it-again',
        turnIndex: 0,
        playerText: '',
        state: { engagement: 0, tension: 0 },
        recentTranscript: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(res.body.details).toBeInstanceOf(Array);
  });

  it('returns 400 for overlong playerText', async () => {
    const res = await request(app)
      .post('/api/turn')
      .send({
        scenarioId: 'say-it-again',
        turnIndex: 0,
        playerText: 'a'.repeat(501),
        state: { engagement: 0, tension: 0 },
        recentTranscript: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 for invalid state bounds', async () => {
    const res = await request(app)
      .post('/api/turn')
      .send({
        scenarioId: 'say-it-again',
        turnIndex: 0,
        playerText: 'Hello',
        state: { engagement: 100, tension: 0 },
        recentTranscript: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 for invalid scenarioId', async () => {
    const res = await request(app)
      .post('/api/turn')
      .send({
        scenarioId: 'wrong',
        turnIndex: 0,
        playerText: 'Hello',
        state: { engagement: 0, tension: 0 },
        recentTranscript: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 for malformed JSON body with stable error shape', async () => {
    const res = await request(app)
      .post('/api/turn')
      .set('Content-Type', 'application/json')
      .send('{"bad":');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toBe('Invalid request');
    expect(res.body.details).toEqual([
      {
        path: [],
        message: 'Malformed JSON body',
      },
    ]);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.message).toBeUndefined();
  });

  it('returns 400 for whitespace-only transcript text', async () => {
    const res = await request(app)
      .post('/api/turn')
      .send({
        scenarioId: 'say-it-again',
        turnIndex: 0,
        playerText: 'Hello',
        state: { engagement: 0, tension: 0 },
        recentTranscript: [
          { speaker: 'player', text: '   ' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });
});
