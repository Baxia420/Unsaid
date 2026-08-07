export type MemoryCategory = 'relationship' | 'exhibition' | 'silence' | 'repair';
export type MemoryValence = 'warm' | 'painful' | 'mixed';
export type SceneMove =
  | 'answer'
  | 'react'
  | 'ask'
  | 'challenge'
  | 'reveal_memory'
  | 'recall_relationship'
  | 'soften'
  | 'set_boundary'
  | 'withdraw'
  | 'comfort_player';
export type ActiveBelief =
  | 'i_did_not_matter'
  | 'they_cared_but_failed_me'
  | 'they_want_relief'
  | 'repair_might_be_possible'
  | 'i_am_not_ready';
export type GenuineQuestionClassification =
  | 'none'
  | 'experience'
  | 'clarification'
  | 'relationship_status'
  | 'repair'
  | 'comparison'
  | 'hostile_rhetorical';

export interface CharacterMemory {
  id: string;
  category: MemoryCategory;
  canonicalStatement: string;
  tags: string[];
  valence: MemoryValence;
}

export interface OutcomeEvidence {
  playerCenteredGuiltCount: number;
  reassurancePressureCount: number;
  friendComfortMoveCount: number;
}

export interface NarrativeState {
  revealedMemoryIds: string[];
  recentSceneMoves: SceneMove[];
  activeBelief: ActiveBelief;
  softeningEvidence: number;
  unresolvedQuestion: string | null;
  outcomeEvidence: OutcomeEvidence;
}

export const CHARACTER_PROFILE = [
  'Observant and restrained; she notices inconsistencies and usually speaks briefly.',
  'She avoids public confrontation but can become sharp when humiliation corners her.',
  'She wants honesty, fears appearing needy, and resents that she still wants the friendship.',
  'She uses understatement, pauses, and uncomfortable honesty; she can soften without forgiving.',
] as const;

export const CHARACTER_MEMORIES: CharacterMemory[] = [
  { id: 'coffee_order', category: 'relationship', canonicalStatement: 'She remembers how the player takes their coffee.', tags: ['coffee', 'care', 'cafe'], valence: 'warm' },
  { id: 'midnight_messages', category: 'relationship', canonicalStatement: 'She answers the player\'s messages after midnight.', tags: ['messages', 'support', 'care'], valence: 'warm' },
  { id: 'not_really_fine', category: 'relationship', canonicalStatement: 'She notices when the player says "I\'m fine" but is not fine.', tags: ['honesty', 'care', 'noticing'], valence: 'warm' },
  { id: 'choosing_photos', category: 'exhibition', canonicalStatement: 'The player helped her choose which exhibition photographs to display.', tags: ['photographs', 'exhibition', 'trust'], valence: 'mixed' },
  { id: 'cafe_openness', category: 'relationship', canonicalStatement: 'They used to talk openly at this café.', tags: ['cafe', 'honesty', 'history'], valence: 'warm' },
  { id: 'empty_chair', category: 'exhibition', canonicalStatement: 'She kept an empty chair for the player at the exhibition.', tags: ['chair', 'absence', 'exhibition'], valence: 'painful' },
  { id: 'checked_door', category: 'exhibition', canonicalStatement: 'She checked the door when it opened because she expected the player to arrive.', tags: ['door', 'waiting', 'exhibition'], valence: 'painful' },
  { id: 'guest_asked', category: 'exhibition', canonicalStatement: 'Another guest asked whether the player was still coming.', tags: ['guest', 'humiliation', 'exhibition'], valence: 'painful' },
  { id: 'defended_player', category: 'exhibition', canonicalStatement: 'She defended the player to that guest.', tags: ['guest', 'loyalty', 'lie'], valence: 'mixed' },
  { id: 'packed_after_exhibition', category: 'exhibition', canonicalStatement: 'She packed up afterward.', tags: ['packing', 'absence', 'aftermath'], valence: 'painful' },
  { id: 'missed_player', category: 'silence', canonicalStatement: 'She missed the player during the three weeks of silence.', tags: ['silence', 'attachment', 'friendship'], valence: 'mixed' },
  { id: 'friendship_uncertain', category: 'repair', canonicalStatement: 'Part of her still wants the friendship to survive.', tags: ['repair', 'future', 'friendship'], valence: 'mixed' },
];

const MEMORY_EVIDENCE: Record<string, RegExp> = {
  coffee_order: /\bcoffee\b/i,
  midnight_messages: /\bmidnight\b[^.!?]{0,50}\bmessages?\b|\bmessages?\b[^.!?]{0,50}\bmidnight\b/i,
  not_really_fine: /\b(?:i'm|i am|you(?:'re| are)) fine\b/i,
  choosing_photos: /\b(?:photos?|photographs?)\b/i,
  cafe_openness: /(?:café|cafe)(?=\s|[.,!?]|$)[^.!?]{0,80}\b(?:talk(?:ed|ing)?|open(?:ly)?|everything)\b|\b(?:talk(?:ed|ing)?|open(?:ly)?|everything)\b[^.!?]{0,80}(?:café|cafe)(?=\s|[.,!?]|$)/i,
  empty_chair: /\bempty\s+chair\b/i,
  checked_door: /\bdoor\b/i,
  guest_asked: /\bguest\b[^.!?]{0,80}\b(?:ask(?:ed|ing)?|coming)\b|\b(?:ask(?:ed|ing)?|coming)\b[^.!?]{0,80}\bguest\b/i,
  defended_player: /\bdefend(?:ed|ing)?\b/i,
  packed_after_exhibition: /\bpack(?:ed|ing)?\s+up\b/i,
  missed_player: /\bmiss(?:ed|ing)?\s+you\b/i,
  friendship_uncertain: /\bfriendship\b[^.!?]{0,80}\b(?:surviv(?:e|ed)|want(?:s|ed)?|sav(?:e|ed))\b|\b(?:surviv(?:e|ed)|want(?:s|ed)?|sav(?:e|ed))\b[^.!?]{0,80}\bfriendship\b/i,
};

export function memoryWasRevealed(memory: CharacterMemory, characterText: string): boolean {
  return MEMORY_EVIDENCE[memory.id]?.test(characterText) ?? false;
}

export function isPlayerCenteredGuilt(text: string): boolean {
  return /\b(?:i feel|i am|i'm)\s+(?:so\s+)?(?:horrible|terrible|awful|guilty)\b|\b(?:i am|i'm)\s+(?:a\s+)?(?:terrible|bad|awful)\s+person\b|\b(?:cannot|can't)\s+forgive\s+myself\b|\bi\s+hate\s+myself\b/i.test(text);
}

export function isReassurancePressure(text: string): boolean {
  return /\b(?:please\s+)?(?:tell|say|promise)\s+(?:me\s+)?(?:that\s+)?(?:i(?:'m| am)\s+not\s+(?:a\s+)?(?:terrible|bad|awful)|we(?:'re| are)\s+okay)\b|\bi\s+need\s+you\s+to\s+(?:say|tell|promise|forgive)\b|\bforgive\s+me\s+so\s+i\s+can\b/i.test(text);
}

export function isFriendComfortingPlayer(text: string): boolean {
  if (/\b(?:not ready|cannot|can't|will not|won't|do not|don't)\b[^.!?]{0,50}\b(?:say|promise)?\s*we(?:'re| are)\s+okay\b/i.test(text)) {
    return false;
  }
  return /\b(?:you(?:'re| are)\s+not\s+(?:a\s+)?(?:terrible|bad|awful)\s+person|i\s+(?:do not|don't)\s+think\s+you(?:'re| are)\s+(?:a\s+)?(?:terrible|bad|awful)\s+person|this\s+(?:does not|doesn't)\s+make\s+you\s+(?:a\s+)?(?:terrible|bad|awful)\s+person|i\s+forgive\s+you|we(?:'re| are)\s+okay|i\s+know\s+you\s+(?:did not|didn't)\s+mean\s+to)\b/i.test(text);
}

export function createNarrativeState(): NarrativeState {
  return {
    revealedMemoryIds: [],
    recentSceneMoves: [],
    activeBelief: 'i_did_not_matter',
    softeningEvidence: 0,
    unresolvedQuestion: null,
    outcomeEvidence: {
      playerCenteredGuiltCount: 0,
      reassurancePressureCount: 0,
      friendComfortMoveCount: 0,
    },
  };
}
