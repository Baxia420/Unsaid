import { useState } from 'react';
import { useGameStore } from '../game/store';
import { SCENARIO } from '../game/scenario';
import {
  PORTRAIT_CLOSED,
  PORTRAIT_DATA_STATE,
} from './cinematicPresentation';
import type { PlayerIntent } from '../game/types';
import './ConversationScene.css';

const INTENTIONS: Array<{
  id: PlayerIntent;
  label: string;
  description: string;
}> = [
  { id: 'understand', label: 'Understand', description: 'Ask and listen.' },
  { id: 'acknowledge', label: 'Acknowledge', description: 'Own the harm.' },
  { id: 'explain', label: 'Explain', description: 'Give your context.' },
  { id: 'repair', label: 'Repair', description: 'Offer a next step.' },
];

export default function ConversationScene() {
  const game = useGameStore();
  const portraitSource = PORTRAIT_CLOSED[game.portraitState];
  const [loadedPortrait, setLoadedPortrait] = useState<string | null>(null);
  const [failedPortrait, setFailedPortrait] = useState<string | null>(null);

  if (game.mode === 'title') {
    return (
      <main className="cs-root" data-app-mode="title">
        <section className="cs-outcome-card">
          <h1>UNSAID</h1>
          <p>A conversation can change only when it is honest.</p>
          <button type="button" onClick={game.start}>Start</button>
        </section>
      </main>
    );
  }

  if (game.mode === 'prologue') {
    return (
      <main className="cs-root" data-app-mode="prologue">
        <section className="cs-outcome-card">
          <h1>Before you speak</h1>
          {SCENARIO.prologue.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <button type="button" onClick={game.continueFromPrologue}>Continue</button>
          <button type="button" onClick={game.returnToTitle}>Return to title</button>
        </section>
      </main>
    );
  }

  if (game.mode === 'outcome' && game.outcome) {
    return (
      <main className="cs-root cs-outcome-mode" data-app-mode="outcome">
        <section className="cs-outcome-card">
          <h1>{game.outcome.title}</h1>
          <p>{game.outcome.description}</p>
          <button type="button" onClick={game.restart}>Replay</button>
          <button type="button" onClick={game.returnToTitle}>Return to title</button>
        </section>
      </main>
    );
  }

  const isPaused = game.mode === 'paused';
  const isClosing = game.mode === 'closing';
  const isLoading = game.status === 'loading';
  const canSend =
    Boolean(game.input.trim()) &&
    Boolean(game.selectedIntention) &&
    game.mode === 'playing' &&
    !isLoading &&
    game.turnIndex < SCENARIO.totalTurns;
  const lastCharacterLine = [...game.transcript]
    .reverse()
    .find((entry) => entry.speaker === 'character');
  const portraitLoaded =
    loadedPortrait === portraitSource && failedPortrait !== portraitSource;

  return (
    <main className="cs-root" data-app-mode={game.mode}>
      <section className="cs-stage" aria-label="Conversation stage">
        <div className="cs-art-canvas" aria-hidden="true">
          <div className="cs-background" />
          <div
            className="cs-portrait-frame"
            data-portrait-state={PORTRAIT_DATA_STATE[game.portraitState]}
          >
            <div
              className={`cs-portrait-silhouette${portraitLoaded ? ' cs-portrait-silhouette--hidden' : ''}`}
              data-portrait-state={PORTRAIT_DATA_STATE[game.portraitState]}
            />
            <img
              key={portraitSource}
              className="cs-portrait-img"
              src={portraitSource}
              alt=""
              draggable={false}
              onLoad={() => setLoadedPortrait(portraitSource)}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                setFailedPortrait(portraitSource);
              }}
            />
          </div>
          <div className="cs-table-foreground" />
        </div>
        {lastCharacterLine && (
          <div className="cs-dialogue-card" role="status" aria-live="polite">
            <p>{lastCharacterLine.text}</p>
          </div>
        )}
      </section>

      <section className="cs-dock" aria-label="Conversation controls">
        <header>
          <span>Turn {Math.min(game.turnIndex + 1, SCENARIO.totalTurns)} of {SCENARIO.totalTurns}</span>
          <span aria-label="Connection state">Connection</span>
          <span aria-label="Pressure state">Pressure</span>
          {!isPaused && !isClosing && (
            <button type="button" onClick={game.pause}>Pause</button>
          )}
        </header>

        {isPaused ? (
          <div role="dialog" aria-label="Pause menu">
            <p>The conversation is paused.</p>
            <button type="button" onClick={game.resume}>Resume</button>
            <button type="button" onClick={game.returnToTitle}>Return to title</button>
          </div>
        ) : isClosing ? (
          <div role="region" aria-label="Final closing">
            <p>{game.closingMessage}</p>
            <button type="button" onClick={game.continueToOutcome}>Continue</button>
          </div>
        ) : (
          <>
            <fieldset disabled={isLoading}>
              <legend>What are you trying to do?</legend>
              {INTENTIONS.map((intention) => (
                <button
                  key={intention.id}
                  type="button"
                  aria-pressed={game.selectedIntention === intention.id}
                  onClick={() => game.selectIntention(intention.id)}
                >
                  {intention.label}
                  <small>{intention.description}</small>
                </button>
              ))}
            </fieldset>

            {game.assessments.length > 0 && (
              <aside aria-label="Intent versus impact">
                <strong>Intent vs. Impact</strong>
                <p>{game.assessments.at(-1)?.impactReason}</p>
              </aside>
            )}

            {game.status === 'error' && (
              <div role="alert">
                {game.error}
                <button type="button" onClick={game.retryTurn}>Retry</button>
              </div>
            )}

            <textarea
              value={game.input}
              onChange={(event) => game.setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) void game.submitTurn();
                }
              }}
              disabled={isLoading}
              maxLength={SCENARIO.maxPlayerTextLength}
              aria-label="Your message"
              placeholder="Say something…"
              rows={3}
            />
            <button type="button" onClick={game.submitTurn} disabled={!canSend}>
              {isLoading ? 'Sending…' : 'Send message'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
