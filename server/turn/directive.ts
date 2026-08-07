import type { TurnRequest } from '../../src/game/types';
import {
  CHARACTER_MEMORIES,
  createNarrativeState,
  isFriendComfortingPlayer,
  isPlayerCenteredGuilt,
  isReassurancePressure,
  memoryWasRevealed,
  type ActiveBelief,
  type CharacterMemory,
  type GenuineQuestionClassification,
  type NarrativeState,
  type SceneMove,
} from '../../src/game/narrative';

export type TurnTone = 'guarded' | 'hurt' | 'sharp' | 'softer' | 'tired' | 'uncertain';
export type TargetLength = 'very_short' | 'short' | 'medium' | 'long';

export interface TurnDirective {
  primaryMove: SceneMove;
  mustAddress: string;
  offeredMemory: CharacterMemory | null;
  avoidTopics: string[];
  tone: TurnTone;
  targetLength: TargetLength;
  genuineQuestion: GenuineQuestionClassification;
}

const HARMFUL = /move on|overreact|not my fault|big deal|fine now|say (?:we(?:'re| are)|it(?:'s| is)) okay|just one event|do not care|don't care|by+e+/i;
const SINCERE = /sorry|hurt you|let you down|mattered|my fault|should have|respect whatever|what do you need|repair|rebuild/i;
const QUESTION_OPENING = /^(?:what|why|how|when|where|who|has|have|did|do|does|can|could|would|is|are)\b/i;

export function classifyGenuineQuestion(text: string): GenuineQuestionClassification {
  const trimmed = text.trim();
  const looksLikeQuestion = trimmed.includes('?') || QUESTION_OPENING.test(trimmed) || /\bi (?:do not|don't) understand\b/i.test(trimmed);
  if (!looksLikeQuestion) return 'none';
  if (isReassurancePressure(trimmed)) return 'none';
  if (/\bwhy (?:are|were) you (?:overreacting|so dramatic|making (?:this|it))|\bwhat(?:'s| is) wrong with you|\bwhy can(?:not|'t) you just\b/i.test(trimmed)) return 'hostile_rhetorical';
  if (/\bwhat (?:chair|do you mean|are you talking about)|\bwait\b|\bi (?:do not|don't) understand|\bcan you clarify|\bwhich\b/i.test(trimmed)) return 'clarification';
  if (/\bhow are (?:things|we)|\bwhere (?:do we|are we)|\bwhat are we|\bhas this changed how you see me|\bare we (?:still|okay)/i.test(trimmed)) return 'relationship_status';
  if (/\bwhat can i do|\bwhat do you need|\bhow can i (?:help|repair|make|rebuild)|\bwhat would (?:help|repair|honesty)|\bcan i (?:fix|repair|make)/i.test(trimmed)) return 'repair';
  if (/\banything like (?:that|this)|\bcompared (?:with|to)|\bwould you have|\bif (?:you|i) had/i.test(trimmed)) return 'comparison';
  return 'experience';
}

function directQuestion(text: string, classification: GenuineQuestionClassification): string | null {
  if (classification === 'none' || classification === 'hostile_rhetorical') return null;
  if (/anyway|how has work|change the subject/i.test(text)) return null;
  return text.trim().slice(0, 240);
}

function chooseMemory(request: TurnRequest, state: NarrativeState, warm: boolean): CharacterMemory | null {
  const eligible = CHARACTER_MEMORIES.filter(
    (memory) =>
      !state.revealedMemoryIds.includes(memory.id) &&
      (warm ? memory.valence !== 'painful' : memory.valence !== 'warm')
  );
  const terms = request.playerText.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  return eligible.sort(
    (a, b) =>
      b.tags.filter((tag) => terms.includes(tag)).length -
        a.tags.filter((tag) => terms.includes(tag)).length ||
      a.id.localeCompare(b.id)
  )[0] ?? null;
}

export function createTurnDirective(request: TurnRequest): TurnDirective {
  const state = request.narrativeState ?? createNarrativeState();
  const genuineQuestion = classifyGenuineQuestion(request.playerText);
  const question = directQuestion(request.playerText, genuineQuestion);
  const harmful = HARMFUL.test(request.playerText) || genuineQuestion === 'hostile_rhetorical';
  const sincere = SINCERE.test(request.playerText) || request.selectedIntention === 'acknowledge' || request.selectedIntention === 'repair';
  const recent = state.recentSceneMoves.slice(-2);
  let primaryMove: SceneMove;

  if (question) primaryMove = 'answer';
  else if (harmful || isReassurancePressure(request.playerText)) primaryMove = request.state.tension >= 5 ? 'withdraw' : 'challenge';
  else if (sincere) primaryMove = state.softeningEvidence > 0 ? 'recall_relationship' : 'soften';
  else if (request.turnIndex >= 6) primaryMove = 'reveal_memory';
  else primaryMove = request.turnIndex % 3 === 1 ? 'ask' : 'react';

  if (
    recent.every((move) => move === 'set_boundary' || move === 'withdraw') &&
    recent.length === 2 &&
    primaryMove === 'withdraw'
  ) primaryMove = harmful ? 'challenge' : 'react';
  if (recent.at(-1) === 'ask' && primaryMove === 'ask') primaryMove = 'react';

  const warm = primaryMove === 'recall_relationship' || primaryMove === 'soften';
  const offeredMemory = ['reveal_memory', 'recall_relationship'].includes(primaryMove)
    ? chooseMemory(request, state, warm)
    : null;
  if (!offeredMemory && (primaryMove === 'reveal_memory' || primaryMove === 'recall_relationship')) {
    primaryMove = warm ? 'soften' : 'react';
  }

  const tone: TurnTone = harmful || isReassurancePressure(request.playerText)
    ? 'sharp'
    : sincere
      ? (state.softeningEvidence ? 'softer' : 'uncertain')
      : request.state.tension >= 5
        ? 'hurt'
        : request.turnIndex >= 7
          ? 'tired'
          : 'guarded';
  const targetLength: TargetLength = offeredMemory
    ? 'long'
    : primaryMove === 'react' || primaryMove === 'withdraw'
      ? 'very_short'
      : question
        ? 'medium'
        : 'short';
  const avoidTopics = state.revealedMemoryIds
    .slice(-4)
    .flatMap((id) => CHARACTER_MEMORIES.find((memory) => memory.id === id)?.tags.slice(0, 1) ?? []);

  return {
    primaryMove,
    mustAddress: question ?? request.playerText.slice(0, 240),
    offeredMemory,
    avoidTopics,
    tone,
    targetLength,
    genuineQuestion,
  };
}

export function advanceNarrativeState(
  request: TurnRequest,
  directive: TurnDirective,
  characterText = ''
): NarrativeState {
  const state = request.narrativeState ?? createNarrativeState();
  const sincere = SINCERE.test(request.playerText) || request.selectedIntention === 'acknowledge' || request.selectedIntention === 'repair';
  const harmful = HARMFUL.test(request.playerText) || directive.genuineQuestion === 'hostile_rhetorical' || isReassurancePressure(request.playerText);
  const friendComforted = isFriendComfortingPlayer(characterText);
  const revealedMemory = directive.offeredMemory && memoryWasRevealed(directive.offeredMemory, characterText)
    ? directive.offeredMemory
    : null;
  let activeBelief: ActiveBelief = state.activeBelief;

  if (harmful) activeBelief = 'they_want_relief';
  else if (sincere && state.softeningEvidence >= 1) activeBelief = 'repair_might_be_possible';
  else if (sincere) activeBelief = 'they_cared_but_failed_me';

  const actualMove: SceneMove = friendComforted ? 'comfort_player' : directive.primaryMove;
  return {
    revealedMemoryIds: revealedMemory
      ? [...new Set([...state.revealedMemoryIds, revealedMemory.id])]
      : state.revealedMemoryIds,
    recentSceneMoves: [...state.recentSceneMoves, actualMove].slice(-4),
    activeBelief,
    softeningEvidence: Math.max(0, Math.min(5, state.softeningEvidence + (sincere ? 1 : 0) - (harmful ? 1 : 0))),
    unresolvedQuestion: directive.primaryMove === 'ask' ? directive.mustAddress : null,
    outcomeEvidence: {
      playerCenteredGuiltCount: state.outcomeEvidence.playerCenteredGuiltCount + (isPlayerCenteredGuilt(request.playerText) ? 1 : 0),
      reassurancePressureCount: state.outcomeEvidence.reassurancePressureCount + (isReassurancePressure(request.playerText) ? 1 : 0),
      friendComfortMoveCount: state.outcomeEvidence.friendComfortMoveCount + (friendComforted ? 1 : 0),
    },
  };
}
