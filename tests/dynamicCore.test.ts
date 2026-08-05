import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { SCENARIO } from '../src/game/scenario';
import { buildLivePrompt } from '../server/turn/prompt';
import { makeRequest } from './helpers';

const ROOT = resolve(__dirname, '..');
const STORE_SOURCE = readFileSync(resolve(ROOT, 'src/game/store.ts'), 'utf8');

describe('dynamic gameplay contract', () => {
  it('allows exactly 15 committed turns', () => expect(SCENARIO.totalTurns).toBe(15));
  it('owns the prologue in scenario data', () => {
    expect(SCENARIO.prologue.join(' ')).toContain('nine years');
    expect(SCENARIO.prologue.join(' ')).toContain('important public event');
  });
  it('contains all fixed facts', () => {
    expect(SCENARIO.facts).toEqual(expect.arrayContaining(['limited invitation', 'broken promise', 'false excuse', 'waiting at the door', 'three weeks of silence']));
  });
  it('has no mandatory per-turn story script', () => {
    expect(SCENARIO).not.toHaveProperty('beats');
    expect(SCENARIO).not.toHaveProperty('chapters');
  });
  it('has no rehearsal or imagined-response domain state', () => {
    expect(STORE_SOURCE.toLowerCase()).not.toContain('rehears');
    expect(STORE_SOURCE).not.toContain('imaginedResponse');
  });
});

describe('dynamic production prompt', () => {
  const request = makeRequest({
    turnIndex: 6,
    selectedIntention: 'explain',
    state: { engagement: 2, tension: 4 },
    recentTranscript: [
      { speaker: 'character', text: 'First line.' },
      { speaker: 'player', text: 'Earlier player line.' },
      { speaker: 'character', text: 'Earlier friend line.' },
    ],
  });
  const prompt = buildLivePrompt(request);

  it.each([
    'nine years', 'important public event', 'promised to attend', 'falsely said',
    'checked the door', 'weeks of silence', 'café',
  ])('includes fixed fact: %s', (fact) => expect(prompt.system).toContain(fact));
  it('passes the complete transcript', () => {
    expect(prompt.user).toContain('First line.');
    expect(prompt.user).toContain('Earlier player line.');
    expect(prompt.user).toContain('Earlier friend line.');
  });
  it('passes intention and emotional state', () => {
    expect(prompt.user).toContain('Selected intention: explain');
    expect(prompt.user).toContain('Connection: 2');
    expect(prompt.user).toContain('Pressure: 4');
  });
  it.each([
    'turn number', 'facts surface naturally', 'early', 'late recovery',
    'regression', 'failure', 'Do not require keywords', 'automatically forgive',
  ])('includes dynamic safeguard: %s', (rule) => {
    expect(prompt.system.toLowerCase()).toContain(rule.toLowerCase());
  });
  it('prohibits AI, game, prompt, score, and outcome terminology', () => {
    for (const term of ['AI', 'prompts', 'game mechanics', 'scores', 'outcome titles']) {
      expect(prompt.system).toContain(term);
    }
  });
  it('does not request closures before turn 15', () => {
    expect(prompt.system).toContain('Do not return finalClosures on this turn.');
  });
  it('requests all three closures on turn 15 without model outcome selection', () => {
    const finalPrompt = buildLivePrompt(makeRequest({ turnIndex: 14 }));
    expect(finalPrompt.system).toContain('even, smoothed, and the_speech');
    expect(finalPrompt.system).toContain('Do not choose an outcome');
  });
});
