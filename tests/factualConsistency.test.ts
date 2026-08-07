import { describe, expect, it, vi } from 'vitest';
import type { ModelAdapter } from '../server/adapters/ModelAdapter';
import { findFactualIssues } from '../server/turn/factualValidation';
import { ModelOutputSchema } from '../server/turn/schema';
import { processTurn, RecoverableTurnError } from '../server/turn/service';
import { makeModelOutput, makeRequest } from './helpers';

function validated(characterText: string) {
  return ModelOutputSchema.parse(makeModelOutput({ characterText }));
}

describe('narrow factual consistency validator', () => {
  it.each([
    ['the chair we picked out together', 'INVENTED_CHAIR_SELECTION'],
    ['We spent two hours choosing the chair.', 'INVENTED_CHAIR_SELECTION'],
    ['We talked about how it would look in the photos.', 'INVENTED_CHAIR_PHOTO_HISTORY'],
    ['Six people showed up for me.', 'IMPOSSIBLE_GUEST_COUNT'],
    ['There were six other guests waiting.', 'IMPOSSIBLE_GUEST_COUNT'],
    ['I packed up the room by myself.', 'UNSUPPORTED_PACKING_ALONE'],
  ])('rejects "%s"', (characterText, code) => {
    expect(findFactualIssues(validated(characterText))).toContain(code);
  });

  it.each([
    'I kept an empty chair for you.',
    'Another guest asked whether you were still coming.',
    'I packed up afterward.',
    'You helped me choose the photographs.',
    'Five other people were there when I looked at the door.',
  ])('accepts canonical wording "%s"', (characterText) => {
    expect(findFactualIssues(validated(characterText))).toEqual([]);
  });

  it('rejects an invalid provider response without a hidden recovery request', async () => {
    const primary: ModelAdapter = {
      generateTurn: vi.fn(async () => makeModelOutput({ characterText: 'We spent two hours choosing the chair.' })),
    };
    const recovery: ModelAdapter = {
      generateTurn: vi.fn(async () => makeModelOutput({ characterText: 'Recovered.' })),
    };

    await expect(processTurn(makeRequest(), primary, recovery)).rejects.toBeInstanceOf(RecoverableTurnError);
    expect(primary.generateTurn).toHaveBeenCalledOnce();
    expect(recovery.generateTurn).not.toHaveBeenCalled();
  });
});
