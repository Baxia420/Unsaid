import { SCENARIO } from '../game/scenario';
import { useGameStore } from '../game/store';
import './ConversationScene.css';

const portraitLabels: Record<string, string> = {
  distant: 'Distant',
  defensive: 'Defensive',
  hurt_exposed: 'Hurt / Exposed',
  connected: 'Connected',
};

export default function ConversationScene() {
  const {
    transcript,
    portraitState,
    input,
    status,
    error,
    setInput,
    submitTurn,
    retryTurn,
  } = useGameStore();

  const isLoading = status === 'loading';
  const isError = status === 'error';
  const canSubmit = input.trim().length > 0 && !isLoading;

  return (
    <div className="conversation-scene">
      <header className="scene-header">
        <h1>{SCENARIO.title}</h1>
        <p>{SCENARIO.description}</p>
      </header>

      <div className="portrait-block">
        <div className={`portrait-placeholder portrait-${portraitState}`} />
        <span className="portrait-label">
          {portraitLabels[portraitState] ?? portraitState}
        </span>
      </div>

      <div className="transcript">
        {transcript.map((entry, i) => (
          <div key={i} className={`transcript-entry ${entry.speaker}`}>
            <span className="speaker">{entry.speaker}:</span>
            <span className="text">{entry.text}</span>
          </div>
        ))}
      </div>

      <div className="input-area">
        {isError && (
          <div className="error-banner">
            <span>{error}</span>
            <button type="button" onClick={retryTurn} disabled={isLoading}>
              Retry
            </button>
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) submitTurn();
            }
          }}
          placeholder="Type your message..."
          rows={3}
          disabled={isLoading}
          maxLength={SCENARIO.maxPlayerTextLength}
        />

        <button
          type="button"
          onClick={submitTurn}
          disabled={!canSubmit}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
