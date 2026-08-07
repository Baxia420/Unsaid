import type { FinalClosures } from '../../src/game/types.ts';
import type { ValidatedModelOutput } from './schema.ts';

export type FactualIssueCode =
  | 'INVENTED_CHAIR_SELECTION'
  | 'INVENTED_CHAIR_PHOTO_HISTORY'
  | 'IMPOSSIBLE_GUEST_COUNT'
  | 'UNSUPPORTED_PACKING_ALONE';

interface FactualRule {
  code: FactualIssueCode;
  patterns: RegExp[];
}

const RULES: FactualRule[] = [
  {
    code: 'INVENTED_CHAIR_SELECTION',
    patterns: [
      /\b(?:we|you|i)\b[^.!?]{0,80}\b(?:pick(?:ed)?\s+out|cho(?:ose|se|osing)|select(?:ed|ing))\b[^.!?]{0,50}\bchair\b/i,
      /\bchair\b[^.!?]{0,80}\b(?:we|you|i)\b[^.!?]{0,40}\b(?:pick(?:ed)?\s+out|cho(?:ose|se|osing)|select(?:ed|ing))\b/i,
      /\b(?:hours?|minutes?)\b[^.!?]{0,40}\b(?:pick(?:ed)?\s+out|cho(?:ose|se|osing)|select(?:ed|ing))\b[^.!?]{0,40}\bchair\b/i,
    ],
  },
  {
    code: 'INVENTED_CHAIR_PHOTO_HISTORY',
    patterns: [
      /\bchair\b[^.!?]{0,80}\b(?:photos?|photographs?)\b/i,
      /\b(?:photos?|photographs?)\b[^.!?]{0,80}\bchair\b/i,
      /\btalked\s+about\s+how\s+it\s+would\s+look\s+in\s+(?:the\s+)?(?:photos?|photographs?)\b/i,
    ],
  },
  {
    code: 'IMPOSSIBLE_GUEST_COUNT',
    patterns: [
      /\b(?:all\s+)?six\s+(?:other\s+)?(?:people|guests|friends|invitees)\b[^.!?]{0,60}\b(?:showed\s+up|came|attended|arrived|were\s+there)\b/i,
      /\b(?:showed\s+up|came|attended|arrived|were\s+there)\b[^.!?]{0,60}\b(?:all\s+)?six\s+(?:other\s+)?(?:people|guests|friends|invitees)\b/i,
      /\bsix\s+other\s+(?:people|guests|friends|invitees)\b/i,
    ],
  },
  {
    code: 'UNSUPPORTED_PACKING_ALONE',
    patterns: [
      /\bpack(?:ed|ing)?\s+up\b[^.!?]{0,60}\b(?:alone|by\s+(?:my|her)self|on\s+(?:my|her)\s+own)\b/i,
      /\b(?:alone|by\s+(?:my|her)self|on\s+(?:my|her)\s+own)\b[^.!?]{0,60}\bpack(?:ed|ing)?\s+up\b/i,
    ],
  },
];

function outputText(output: ValidatedModelOutput): string[] {
  const closures: FinalClosures | undefined = output.finalClosures;
  return [
    output.characterText,
    ...(closures ? [closures.even, closures.smoothed, closures.the_speech] : []),
  ];
}

export function findFactualIssues(output: ValidatedModelOutput): FactualIssueCode[] {
  const texts = outputText(output);
  return RULES
    .filter((rule) => texts.some((text) => rule.patterns.some((pattern) => pattern.test(text))))
    .map((rule) => rule.code);
}
