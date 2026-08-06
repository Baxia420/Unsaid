export type MemoryCategory = 'relationship' | 'exhibition' | 'silence' | 'repair';
export type MemoryValence = 'warm' | 'painful' | 'mixed';
export type SceneMove = 'answer' | 'react' | 'ask' | 'challenge' | 'reveal_memory' | 'recall_relationship' | 'soften' | 'set_boundary' | 'withdraw';
export type ActiveBelief = 'i_did_not_matter' | 'they_cared_but_failed_me' | 'they_want_relief' | 'repair_might_be_possible' | 'i_am_not_ready';

export interface CharacterMemory {
  id: string;
  category: MemoryCategory;
  text: string;
  tags: string[];
  valence: MemoryValence;
}

export interface NarrativeState {
  revealedMemoryIds: string[];
  recentSceneMoves: SceneMove[];
  activeBelief: ActiveBelief;
  softeningEvidence: number;
  unresolvedQuestion: string | null;
}

export const CHARACTER_PROFILE = [
  'Observant and restrained; she notices inconsistencies and usually speaks briefly.',
  'She avoids public confrontation but can become sharp when humiliation corners her.',
  'She wants honesty, fears appearing needy, and resents that she still wants the friendship.',
  'She uses understatement, pauses, and uncomfortable honesty; she can soften without forgiving.',
] as const;

export const CHARACTER_MEMORIES: CharacterMemory[] = [
  { id: 'coffee_order', category: 'relationship', text: 'She remembers exactly how the player takes their coffee.', tags: ['coffee', 'care', 'cafe'], valence: 'warm' },
  { id: 'midnight_messages', category: 'relationship', text: 'She has answered the player\'s messages after midnight when they needed her.', tags: ['messages', 'support', 'care'], valence: 'warm' },
  { id: 'not_really_fine', category: 'relationship', text: 'She can usually tell when the player says "I\'m fine" but is not fine.', tags: ['honesty', 'care', 'noticing'], valence: 'warm' },
  { id: 'choosing_photos', category: 'exhibition', text: 'The player helped her choose which exhibition photographs to display.', tags: ['photographs', 'exhibition', 'trust'], valence: 'mixed' },
  { id: 'cafe_openness', category: 'relationship', text: 'They used to talk openly about everything at this café.', tags: ['cafe', 'honesty', 'history'], valence: 'warm' },
  { id: 'empty_chair', category: 'exhibition', text: 'She noticed the player\'s empty chair at the exhibition.', tags: ['chair', 'absence', 'exhibition'], valence: 'painful' },
  { id: 'checked_door', category: 'exhibition', text: 'She kept checking the door because she expected the player to arrive.', tags: ['door', 'waiting', 'exhibition'], valence: 'painful' },
  { id: 'guest_asked', category: 'exhibition', text: 'One of the other guests asked her where the player was.', tags: ['guest', 'humiliation', 'exhibition'], valence: 'painful' },
  { id: 'defended_player', category: 'exhibition', text: 'She defended the player to that guest even though she did not know why they were absent.', tags: ['guest', 'loyalty', 'lie'], valence: 'mixed' },
  { id: 'packed_alone', category: 'exhibition', text: 'She packed up the exhibition afterward without the player there.', tags: ['packing', 'absence', 'aftermath'], valence: 'painful' },
  { id: 'missed_player', category: 'silence', text: 'She missed the player during the three weeks of silence.', tags: ['silence', 'attachment', 'friendship'], valence: 'mixed' },
  { id: 'friendship_uncertain', category: 'repair', text: 'Part of her wants the friendship to survive, but she is uncertain whether it can.', tags: ['repair', 'future', 'friendship'], valence: 'mixed' },
];

export function createNarrativeState(): NarrativeState {
  return { revealedMemoryIds: [], recentSceneMoves: [], activeBelief: 'i_did_not_matter', softeningEvidence: 0, unresolvedQuestion: null };
}
