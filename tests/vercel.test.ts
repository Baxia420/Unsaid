import { readFileSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../api/index';
import { makeRequest } from './helpers';

describe('Vercel production entry points', () => {
  it('exports the existing Express API without starting a listener', async () => {
    const status = await request(app).get('/api/status');
    expect(status.status).toBe(200);
    const turn = await request(app).post('/api/turn').send(makeRequest());
    expect(turn.status).toBe(200);
    expect(turn.body).toHaveProperty('narrative');
  });

  it('handles stripped Vercel function paths (/) gracefully', async () => {
    const statusRoot = await request(app).get('/');
    expect(statusRoot.status).toBe(200);
    expect(statusRoot.body).toHaveProperty('aiMode');

    // Due to Express routing, a POST to / correctly hits the turn route
    const turnRoot = await request(app).post('/').send(makeRequest());
    expect(turnRoot.status).toBe(200);
    expect(turnRoot.body).toHaveProperty('narrative');
  });

  it('returns 404 JSON for unmapped routes instead of hanging', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
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
    // Check that there is an api rewrite
    expect(config.rewrites[0].source).toContain('api');
    expect(config.rewrites[0].destination).toBe('/api');
    // Check the catch-all
    expect(config.rewrites[1].source).toContain('?!api');
    expect(config.rewrites[1].destination).toBe('/index.html');
  });
});
