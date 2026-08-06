import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { formatConversationTranscript } from '../src/components/conversationLog';

const component = readFileSync(resolve(__dirname, '../src/components/ConversationScene.tsx'), 'utf8');

describe('secondary Conversation Log', () => {
  it('copies readable chronological dialogue', () => {
    expect(formatConversationTranscript([{ speaker: 'character', text: 'First.' }, { speaker: 'player', text: 'Second.' }])).toBe('Friend: First.\n\nYou: Second.');
  });
  it('replaces the permanent transcript rail with cinematic dialogue', () => {
    expect(component).not.toContain('className="cs-conversation-rail"');
    expect(component).toContain('className="cs-dialogue-card"');
  });
  it('keeps log actions local to presentation state', () => {
    expect(component).toContain('setShowConversationLog(true)');
    expect(component).toContain('Copy Transcript');
    expect(component).toContain('Copy Debug Data');
  });
});
