import { describe, expect, it } from 'vitest';
import { advanceNarrativeState, classifyGenuineQuestion, createTurnDirective } from '../server/turn/directive';
import { CHARACTER_MEMORIES, createNarrativeState, memoryWasRevealed } from '../src/game/narrative';
import { makeRequest } from './helpers';

describe('code-owned turn directive', () => {
  it('is deterministic', () => expect(createTurnDirective(makeRequest())).toEqual(createTurnDirective(makeRequest())));
  it('answers direct questions first', () => {
    const directive = createTurnDirective(makeRequest({ playerText: 'Has anything like that happened to you before?' }));
    expect(directive.primaryMove).toBe('answer');
    expect(directive.mustAddress).toContain('Has anything');
  });
  it('offers only an unrevealed eligible memory', () => {
    const narrativeState = { ...createNarrativeState(), softeningEvidence: 1, revealedMemoryIds: ['coffee_order'] };
    const directive = createTurnDirective(makeRequest({ playerText: 'I am sorry I hurt you.', selectedIntention: 'acknowledge', narrativeState }));
    expect(directive.primaryMove).toBe('recall_relationship');
    expect(directive.offeredMemory?.id).not.toBe('coffee_order');
  });
  it('does not select a revealed memory twice', () => {
    const firstRequest = makeRequest({ turnIndex: 7, playerText: 'I do not know what else to say.', narrativeState: createNarrativeState() });
    const first = createTurnDirective(firstRequest);
    const nextState = advanceNarrativeState(firstRequest, first, first.offeredMemory?.canonicalStatement);
    const second = createTurnDirective(makeRequest({ ...firstRequest, turnIndex: 8, narrativeState: nextState }));
    expect(second.offeredMemory?.id).not.toBe(first.offeredMemory?.id);
  });
  it('prevents a third consecutive withdrawal', () => {
    const narrativeState = { ...createNarrativeState(), recentSceneMoves: ['withdraw', 'set_boundary'] as const };
    expect(createTurnDirective(makeRequest({ playerText: 'Just say we are okay now.', state: { engagement: -4, tension: 8 }, narrativeState: { ...narrativeState, recentSceneMoves: [...narrativeState.recentSceneMoves] } })).primaryMove).not.toBe('withdraw');
  });
  it('softens after sincere wording and challenges harmful wording', () => {
    expect(createTurnDirective(makeRequest({ playerText: 'I am sorry I hurt you.', selectedIntention: 'acknowledge' })).primaryMove).toBe('soften');
    expect(createTurnDirective(makeRequest({ playerText: 'You are overreacting.', selectedIntention: 'explain' })).primaryMove).toBe('challenge');
  });
  it('recognizes the accented café memory as actually revealed', () => {
    const memory = CHARACTER_MEMORIES.find((candidate) => candidate.id === 'cafe_openness');
    expect(memory && memoryWasRevealed(memory, "They used to talk openly at this café.")).toBe(true);
  });
  it.each([
    ['What happened? What did I miss?', 'experience'],
    ["What chair? Wait, I don't understand.", 'clarification'],
    ['How are things between us?', 'relationship_status'],
    ['What can I do now?', 'repair'],
    ['Has anything like this happened before?', 'comparison'],
    ['Why are you overreacting?', 'hostile_rhetorical'],
    ['I am sorry.', 'none'],
  ] as const)('classifies "%s" as %s', (text, classification) => {
    expect(classifyGenuineQuestion(text)).toBe(classification);
  });
});
