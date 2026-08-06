import type { TurnRequest } from '../../src/game/types';
import { CHARACTER_MEMORIES, createNarrativeState, type ActiveBelief, type CharacterMemory, type NarrativeState, type SceneMove } from '../../src/game/narrative';

export type TurnTone = 'guarded' | 'hurt' | 'sharp' | 'softer' | 'tired' | 'uncertain';
export type TargetLength = 'very_short' | 'short' | 'medium' | 'long';
export interface TurnDirective { primaryMove: SceneMove; mustAddress: string; offeredMemory: CharacterMemory | null; avoidTopics: string[]; tone: TurnTone; targetLength: TargetLength; }

const HARMFUL = /forgive|move on|overreact|not my fault|big deal|fine now|say we're okay|just one event/i;
const SINCERE = /sorry|hurt you|let you down|mattered|my fault|should have|respect whatever|what do you need|repair|rebuild/i;

function directQuestion(text: string): string | null {
  const trimmed = text.trim();
  if (/anyway|how has work|change the subject/i.test(trimmed)) return null;
  if (trimmed.includes('?')) return trimmed.slice(0, 240);
  if (/^(what|why|how|when|where|who|has|have|did|do|does|can|could|would|is|are)\b/i.test(trimmed)) return trimmed.slice(0, 240);
  return null;
}

function chooseMemory(request: TurnRequest, state: NarrativeState, warm: boolean): CharacterMemory | null {
  const eligible = CHARACTER_MEMORIES.filter((memory) => !state.revealedMemoryIds.includes(memory.id) && (warm ? memory.valence !== 'painful' : memory.valence !== 'warm'));
  const terms = request.playerText.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  return eligible.sort((a, b) => b.tags.filter((tag) => terms.includes(tag)).length - a.tags.filter((tag) => terms.includes(tag)).length || a.id.localeCompare(b.id))[0] ?? null;
}

export function createTurnDirective(request: TurnRequest): TurnDirective {
  const state = request.narrativeState ?? createNarrativeState();
  const question = directQuestion(request.playerText);
  const harmful = HARMFUL.test(request.playerText);
  const sincere = SINCERE.test(request.playerText) || request.selectedIntention === 'acknowledge' || request.selectedIntention === 'repair';
  const recent = state.recentSceneMoves.slice(-2);
  let primaryMove: SceneMove;
  if (question) primaryMove = 'answer';
  else if (harmful) primaryMove = request.state.tension >= 5 ? 'withdraw' : 'challenge';
  else if (sincere) primaryMove = state.softeningEvidence > 0 ? 'recall_relationship' : 'soften';
  else if (request.turnIndex >= 6) primaryMove = 'reveal_memory';
  else primaryMove = request.turnIndex % 3 === 1 ? 'ask' : 'react';
  if (recent.every((move) => move === 'set_boundary' || move === 'withdraw') && recent.length === 2 && primaryMove === 'withdraw') primaryMove = harmful ? 'challenge' : 'react';
  if (recent.at(-1) === 'ask' && primaryMove === 'ask') primaryMove = 'react';
  const warm = primaryMove === 'recall_relationship' || primaryMove === 'soften';
  const offeredMemory = ['reveal_memory', 'recall_relationship'].includes(primaryMove) ? chooseMemory(request, state, warm) : null;
  if (!offeredMemory && (primaryMove === 'reveal_memory' || primaryMove === 'recall_relationship')) primaryMove = warm ? 'soften' : 'react';
  const tone: TurnTone = harmful ? 'sharp' : sincere ? (state.softeningEvidence ? 'softer' : 'uncertain') : request.state.tension >= 5 ? 'hurt' : request.turnIndex >= 7 ? 'tired' : 'guarded';
  const targetLength: TargetLength = offeredMemory ? 'long' : primaryMove === 'react' || primaryMove === 'withdraw' ? 'very_short' : question ? 'medium' : 'short';
  const avoidTopics = state.revealedMemoryIds.slice(-4).flatMap((id) => CHARACTER_MEMORIES.find((memory) => memory.id === id)?.tags.slice(0, 1) ?? []);
  return { primaryMove, mustAddress: question ?? request.playerText.slice(0, 240), offeredMemory, avoidTopics, tone, targetLength };
}

export function advanceNarrativeState(request: TurnRequest, directive: TurnDirective): NarrativeState {
  const state = request.narrativeState ?? createNarrativeState();
  const sincere = SINCERE.test(request.playerText) || request.selectedIntention === 'acknowledge' || request.selectedIntention === 'repair';
  const harmful = HARMFUL.test(request.playerText);
  let activeBelief: ActiveBelief = state.activeBelief;
  if (harmful) activeBelief = 'they_want_relief';
  else if (sincere && state.softeningEvidence >= 1) activeBelief = 'repair_might_be_possible';
  else if (sincere) activeBelief = 'they_cared_but_failed_me';
  return {
    revealedMemoryIds: directive.offeredMemory ? [...new Set([...state.revealedMemoryIds, directive.offeredMemory.id])] : state.revealedMemoryIds,
    recentSceneMoves: [...state.recentSceneMoves, directive.primaryMove].slice(-4),
    activeBelief,
    softeningEvidence: Math.max(0, Math.min(5, state.softeningEvidence + (sincere ? 1 : 0) - (harmful ? 1 : 0))),
    unresolvedQuestion: directive.primaryMove === 'ask' ? directive.mustAddress : null,
  };
}
