import { describe, expect, it } from 'vitest';
import { detectSuspiciousEcho } from './helpers';

describe('anti-echo diagnostic', () => {
  it('flags substantial parroting of the player sentence', () => {
    expect(detectSuspiciousEcho(
      'I do not know how to explain why I stayed away from the exhibition.',
      'You do not know how to explain why you stayed away from the exhibition? That hurts.'
    )).toBe(true);

    expect(detectSuspiciousEcho(
      'I admit it was my fault and I am sorry.',
      'You admit it was your fault and you are sorry, but that is not enough.'
    )).toBe(true);
  });

  it('allows natural conversation without flags', () => {
    expect(detectSuspiciousEcho(
      'I admit it was my fault.',
      'Okay. Hearing you say that without reaching for an excuse does matter.'
    )).toBe(false);

    expect(detectSuspiciousEcho(
      'I do not know how to explain why I stayed away.',
      'I can believe you were overwhelmed. What I still do not understand is why you chose to lie afterward.'
    )).toBe(false);
  });

  it('allows short deliberate quotes for clarification or calling out', () => {
    expect(detectSuspiciousEcho(
      'I think you are overreacting about all of this.',
      'Overreacting?'
    )).toBe(false);
  });

  it('ignores stop word matches and canonical context nouns', () => {
    expect(detectSuspiciousEcho(
      'I did not go to the cafe for the exhibition photographs.',
      'I was at the cafe looking at the exhibition photographs and it was hard.'
    )).toBe(false);
  });

  it('ignores very short player messages', () => {
    expect(detectSuspiciousEcho(
      'I am sorry.',
      'I am sorry too.'
    )).toBe(false);
  });
});
