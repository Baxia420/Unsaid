import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { buildLivePrompt } from '../server/turn/prompt';
import { SCENARIO } from '../src/game/scenario';
import { makeRequest } from './helpers';

const storeSource = readFileSync(resolve(__dirname, '../src/game/store.ts'), 'utf8');
describe('dynamic gameplay contract', () => {
  it('allows exactly 10 committed turns', () => expect(SCENARIO.totalTurns).toBe(10));
  it('owns the three-part prologue and fixed facts', () => { expect(SCENARIO.prologueParts).toHaveLength(3); expect(SCENARIO.facts).toContain('six invited guests'); });
  it('has no scripted beats or rehearsal state', () => { expect(SCENARIO).not.toHaveProperty('beats'); expect(storeSource.toLowerCase()).not.toContain('rehears'); });
});

describe('Flash Lite production prompt', () => {
  const request = makeRequest({ turnIndex: 6, selectedIntention: 'explain', state: { engagement: 2, tension: 4 }, recentTranscript: [{ speaker: 'character', text: 'First line.' }, { speaker: 'player', text: 'Earlier player line.' }, { speaker: 'character', text: 'Earlier friend line.' }] });
  const prompt = buildLivePrompt(request);
  it.each(['friendship has lasted nine years', 'exhibition happened three weeks ago', 'six invited guests', 'helped choose photographs', 'repeatedly promised', 'stayed away from shame', 'Something came up', 'three weeks of silence'])('includes immutable fact: %s', (fact) => expect(prompt.system).toContain(fact));
  it('passes transcript, intention, and state', () => { expect(prompt.user).toContain('First line.'); expect(prompt.user).toContain('Earlier player line.'); expect(prompt.user).toContain('intention explain'); expect(prompt.user).toContain('Connection 2'); expect(prompt.user).toContain('Pressure 4'); });
  it('contains a code-owned directive', () => { expect(prompt.system).toContain('TURN DIRECTIVE'); expect(prompt.system).toContain('Primary move:'); expect(prompt.system).toContain('Address first:'); });
  it('prohibits system terminology', () => { for (const term of ['AI', 'prompts', 'game mechanics', 'state values', 'outcome titles']) expect(prompt.system).toContain(term); });
  it('requests closures only on turn ten without model outcome selection', () => { expect(prompt.system).toContain('Do not return finalClosures.'); const finalPrompt = buildLivePrompt(makeRequest({ turnIndex: 9 })); expect(finalPrompt.system).toContain('even, smoothed, and the_speech'); expect(finalPrompt.system).toContain('do not choose or name an outcome'); });
  it('uses directive-sized cadence without a minimum', () => { expect(prompt.system).not.toContain('45 to 100 words'); expect(prompt.system).not.toContain('3 to 6 sentences'); expect(prompt.system).toContain('never pad to a minimum'); });
  it('sends at most one selected memory, not the hidden catalogue', () => { expect((prompt.system.match(/Use this one memory accurately/g) ?? [])).toHaveLength(1); expect(prompt.system).not.toContain('She noticed the player\'s empty chair'); });
});
