import { readFileSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import statusApp from '../api/status';
import turnApp from '../api/turn';
import { makeRequest } from './helpers';

describe('Vercel production entry points', () => {
  it('exports the existing Express API without starting a listener', async () => {
    const status = await request(statusApp).get('/api/status');
    expect(status.status).toBe(200);
    const turn = await request(turnApp).post('/api/turn').send(makeRequest());
    expect(turn.status).toBe(200);
    expect(turn.body).toHaveProperty('narrative');
  });

  it('handles stripped Vercel function paths (/) gracefully', async () => {
    const statusRoot = await request(statusApp).get('/');
    expect(statusRoot.status).toBe(200);
    expect(statusRoot.body).toHaveProperty('aiMode');

    const turnRoot = await request(turnApp).post('/').send(makeRequest());
    expect(turnRoot.status).toBe(200);
    expect(turnRoot.body).toHaveProperty('narrative');
  });

  it('returns 404 JSON for unmapped routes instead of hanging', async () => {
    const res = await request(statusApp).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('builds Vite and rewrites only non-API browser routes to the SPA', () => {
    const config = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8'));
    expect(config).toMatchObject({
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
    });
    expect(config.rewrites[0].source).toContain('?!api');
    expect(config.rewrites[0].destination).toBe('/index.html');
  });
});
