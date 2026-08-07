import { describe, expect, it } from 'vitest';
import { buildLivePrompt } from '../server/turn/prompt';
import { makeRequest } from './helpers';

describe('Live Prompt Contract', () => {
  it('instructs model to react to meaning rather than repeat wording', () => {
    const prompt = buildLivePrompt(makeRequest());
    expect(prompt.system).toContain('Respond to the meaning, emotional implication, and relevant detail');
  });

  it('explicitly forbids routine paraphrasing of the latest player message', () => {
    const prompt = buildLivePrompt(makeRequest());
    expect(prompt.system).toContain('Do not begin by restating or paraphrasing the player\'s sentence.');
    expect(prompt.system).toContain('Do not routinely quote the player\'s wording back to them');
  });

  it('instructs that the first sentence should add new conversational information', () => {
    const prompt = buildLivePrompt(makeRequest());
    expect(prompt.system).toContain('The first sentence should normally contribute NEW emotional or conversational information');
    expect(prompt.system).toContain('It should NOT usually be a summary of what the player just said.');
  });

  it('permits short repetition for clarification or calling out a phrase', () => {
    const prompt = buildLivePrompt(makeRequest());
    expect(prompt.system).toContain('unless calling out a hurtful phrase or contradicting them');
  });

  it('instructs model to avoid repeating recent FRIEND opening patterns', () => {
    const prompt = buildLivePrompt(makeRequest());
    expect(prompt.system).toContain('Avoid reusing the same opening construction as either of the last two FRIEND replies');
  });

  it('preserves variable response length based on directive', () => {
    const veryShortPrompt = buildLivePrompt(makeRequest({ playerText: 'I am leaving now.' }));
    expect(veryShortPrompt.system).toContain('a phrase or one brief sentence');

    const longPrompt = buildLivePrompt(makeRequest({ turnIndex: 7 }));
    expect(longPrompt.system).toContain('up to four or five sentences');
  });
});
