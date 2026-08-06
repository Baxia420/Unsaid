import type { TranscriptEntry } from '../game/types';

export function formatConversationTranscript(transcript: TranscriptEntry[]): string {
  return transcript.map((entry) => `${entry.speaker === 'character' ? 'Friend' : 'You'}: ${entry.text}`).join('\n\n');
}
