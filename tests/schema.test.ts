import { describe, it, expect } from 'vitest';
import { ModelOutputSchema } from '../server/turn/schema';

describe('ModelOutputSchema', () => {
  it('accepts valid output', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 1,
        tensionDelta: -1,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty characterText', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: '',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 1,
        tensionDelta: -1,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid intent', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'invalid_intent',
        engagementDelta: 1,
        tensionDelta: -1,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing assessment fields', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects engagementDelta below -3', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: -4,
        tensionDelta: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects engagementDelta above 3', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 4,
        tensionDelta: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects tensionDelta below -3', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 0,
        tensionDelta: -4,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects tensionDelta above 3', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 0,
        tensionDelta: 4,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects fractional engagementDelta', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 1.5,
        tensionDelta: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects fractional tensionDelta', () => {
    const result = ModelOutputSchema.safeParse({
      characterText: 'Hello',
      assessment: {
        intent: 'acknowledge',
        engagementDelta: 0,
        tensionDelta: -2.7,
      },
    });
    expect(result.success).toBe(false);
  });
});
