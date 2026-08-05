# Unsaid

A browser-based cinematic conversation game. This repository contains the first episode, **Say It Again**.

## What Stage 0 Proves

Stage 0 is a fully playable, end-to-end conversation slice with deterministic mock inference. It demonstrates:

- A typed client/server turn loop (`POST /api/turn`) that processes player input and returns a structured character response.
- Code-owned game state: **Engagement** and **Tension** are updated by deterministic server-side logic, not surfaced directly to the model.
- Portrait state derived from accumulated axes as a debug-visible signal of state progression.
- Deterministic fallback behavior when the model adapter returns malformed output or throws an inference error.
- Automated test coverage for state machines, Zod schemas, the turn service, the API route, the mock adapter, the client store, and the HTTP client.
- A single placeholder scenario (Cafe Apology) that supports a short 3–5 turn conversation.

A live AI adapter is available via Google Gemini Developer API. By default, all responses come from `MockModelAdapter`.

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and set variables as needed. `.env` is ignored by Git and must never be committed.

| Variable | Default | Description |
|---|---|---|
| `UNSAID_AI_MODE` | `mock` | `mock` for local development; `recorded` for the deterministic demo-safe path; `live` for Gemini |
| `UNSAID_LIVE_RECOVERY` | `none` | `none` for strict live mode (recommended); `recorded` for one explicit recorded recovery attempt on provider failure |
| `GEMINI_API_KEY` | *(none)* | Google AI Studio API key (required only for live mode) |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | Gemini REST API base URL |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model identifier |
| `GEMINI_TIMEOUT_MS` | `15000` | Request timeout in milliseconds |

**Default is mock.** No API key or paid account is required to run or develop locally.

**Mock mode** (`UNSAID_AI_MODE=mock`) uses `MockModelAdapter` and produces deterministic, keyword-based responses with no network calls.

**Recorded mode** (`UNSAID_AI_MODE=recorded`) uses `RecordedModelAdapter` and produces deterministic, scripted responses with no network calls.

**Strict live mode** (`UNSAID_AI_MODE=live`, `UNSAID_LIVE_RECOVERY=none`) sends every turn to Gemini. If the provider fails or returns invalid output, the server returns HTTP 503 so the client can retry. The turn is not consumed and no silent fallback to mock or recorded dialogue occurs.

**Optional recorded recovery** (`UNSAID_AI_MODE=live`, `UNSAID_LIVE_RECOVERY=recorded`) uses Gemini as the primary adapter. On a single provider failure, it attempts one bounded recovery via `RecordedModelAdapter`. Recovery is explicitly logged and identified in response headers (`X-Unsaid-Recovery-Used`).

If `UNSAID_AI_MODE=live` is set but `GEMINI_API_KEY` is missing or blank, the server emits one warning and runs in recorded mode. No live-AI claim should be made while recorded mode is active; `/api/status` reports the active and recovery modes.

### Diagnostic Script

```bash
npm run diagnose:live
```

This script sends one distinctive test message to Gemini and reports sanitized diagnostics including mode, model, key presence, source, latency, and schema validity. It requires `UNSAID_AI_MODE=live` and a valid `GEMINI_API_KEY`. No secrets are printed. The script exits naturally without calling `process.exit()`.

## Development

```bash
npm run dev
```

This single command starts both the **Express server** and the **Vite development server** via `concurrently`:

- Express API server runs on port `3001`
- Vite dev server runs on port `5173` (strict — will not silently fall back to another port)

If either process crashes, the other shuts down automatically (`--kill-others-on-fail`).

Open the app at: **http://localhost:5173**

All requests to `/api/*` from the browser are proxied to the Express server (`http://localhost:3001`).

To run only the backend:

```bash
npm run server
```

The server logs `source=gemini` or `source=mock` per turn to confirm which adapter answered.

### Port Conflicts

Both ports use strict binding. If port 3001 or 5173 is already occupied, the dev command will fail clearly. To find and stop a stale UNSAID process:

```bash
# Windows
netstat -ano | findstr "3001 5173"
taskkill /PID <pid> /F
```

`.env` is git-ignored and must never be committed.

## Other Commands

| Command | Description |
|---------|-------------|
| `npm run server` | Start Express API server only on port `3001` |
| `npm run type-check` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run the full Vitest test suite |
| `npm run build` | Production build (TypeScript compilation + Vite bundle to `dist/`) |
| `npm run diagnose:live` | One-shot live Gemini diagnostic (mode, key, source, latency, schema validity) |

## Default Runtime

The default runtime uses **`MockModelAdapter`** and requires no paid API key. No `.env` file or provider secrets are needed.

To enable live inference, set `UNSAID_AI_MODE=live` and provide a `GEMINI_API_KEY` in `.env`.

## Live Evaluation

Run the live evaluation corpus against Gemini:

```bash
npm run evaluate:live
```

This requires `UNSAID_AI_MODE=live` and a valid `GEMINI_API_KEY`. It runs 12 café-apology test inputs and reports exact intent classification accuracy and schema validation results. This script is not part of `npm run test` and never runs automatically.

## Tested Fallback Behavior

Automated tests confirm three deterministic fallback paths:

1. **Valid adapter output** → normal state progression via `applyTurn`.
2. **Malformed adapter output** (extra fields, wrong types, missing fields) → deterministic fallback response via `makeFallback` in `server/turn/service.ts`:
   - Character line: "I'm not sure how to respond to that."
   - `intent: 'unclear'`, `engagementDelta: 0`, `tensionDelta: 0`
   - `portraitState` derived from the incoming request state.
3. **Thrown inference error** → identical deterministic fallback response.

See `tests/turnService.test.ts` for the exact assertions.

## Mock Model Behavior

`MockModelAdapter` branches on keywords in `playerText` (case-insensitive) to produce deterministic, varied responses:

| Keyword(s) | Intent | engagementDelta | tensionDelta | Example response |
|---|---|---|---|---|
| `sorry`, `apologize`, `regret` | `repair` | `+2` | `-1` | "I appreciate you saying that. It means more than you know." |
| `why`, `what`, `how could` | `pressure` | `-1` | `+2` | "I don't know if I can answer that right now." |
| `understand`, `listen`, `hear` | `acknowledge` | `+1` | `-1` | "I hear you. I just don't know what to say right now." |
| `defend`, `not my fault`, `blame` | `defend` | `-2` | `+1` | "It feels like you're closing yourself off." |
| `space`, `time`, `away` | `redirect` | `-2` | `-2` | "Maybe some distance would be good for both of us." |
| *(none of the above)* | `unclear` | `0` | `0` | "I'm not sure what you're getting at." |

These deltas are clamped to `[-3, 3]` per turn and accumulated state is clamped to `[-10, 10]` per axis.

## Code Ownership

- **Engagement / Tension ranges** — per-turn deltas are clamped to `[-3, 3]` by `applyTurn` in `src/game/state.ts` using bounds from `src/game/scenario.ts`. Accumulated axes are clamped to `[-10, 10]`.
- **Portrait state** — derived entirely by `derivePortraitState()` in `src/game/state.ts` from the accumulated engagement/tension axes. It is temporarily visible in the UI for debugging.
- **Turn progression** — owned by `applyTurn()` in `src/game/state.ts` on the client and orchestrated by `processTurn()` in `server/turn/service.ts` on the server.
- **Fallback behavior** — deterministic recovery path in `server/turn/service.ts` when the adapter throws or returns malformed output.

## Project Structure

```
.
├── docs/
│   └── CODEBUDDY_STAGE0_CREDIT_EFFICIENT_HANDOFF.md   # Stage 0 milestone spec
├── index.html                                         # Vite entry HTML
├── package.json
├── server.ts                                          # Express bootstrap (dev + prod)
├── vite.config.ts
├── tsconfig.json
├── server/
│   ├── index.ts                                       # Express app factory
│   ├── adapters/
│   │   ├── ModelAdapter.ts                            # Adapter interface
│   │   └── MockModelAdapter.ts                        # Deterministic mock responses
│   └── turn/
│       ├── route.ts                                   # POST /api/turn handler
│       ├── service.ts                                 # Turn orchestration + fallback
│       ├── schema.ts                                  # Zod request/response schemas
│       ├── validation.ts                              # Request validation schema
│       └── prompt.ts                                  # System prompt builder
├── src/
│   ├── main.tsx                                       # React root mount
│   ├── App.tsx                                        # Top-level app shell
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── ConversationScene.tsx                      # Main game UI
│   │   └── ConversationScene.css                      # Minimal placeholder styles
│   ├── game/
│   │   ├── types.ts                                   # Core domain types
│   │   ├── state.ts                                   # applyTurn + derivePortraitState
│   │   ├── store.ts                                   # Zustand client store
│   │   └── scenario.ts                                # Placeholder scenario data
│   └── lib/
│       └── turnClient.ts                              # Fetch wrapper for /api/turn
└── tests/
    ├── mockAdapter.test.ts
    ├── schema.test.ts
    ├── state.test.ts
    ├── store.test.ts
    ├── turnClient.test.ts
    ├── turnRoute.test.ts
    └── turnService.test.ts
```

## Systems Completed in Stage 0

- Client/server turn loop with typed request/response
- Zod schema validation for inbound and outbound turn data
- Deterministic mock model adapter with varied responses based on player input keywords
- Server-side axis clamping and range validation
- Client game state machine (`applyTurn`, `derivePortraitState`)
- Zustand store with optimistic UI, loading states, and retry logic
- React conversation scene with transcript, input, and submit flow
- Express API route with centralized error handling
- Comprehensive automated test suite covering schemas, state, store, client, route, service, and mock adapter
- TypeScript strict mode + production build pipeline

## Known Limitations

- **One placeholder scenario** — the Cafe Apology scene is a short conversation slice, not the final story.
- **Placeholder visuals and minimal CSS** — the current UI is functional but not final artwork.
- **REHEARSE/SAY** — implemented: REHEARSE is local and SAY is routed through the selected server adapter.
- **No final story, endings, artwork, audio, animation, deployment, database, accounts, or analytics.**
- The client currently sends the **accumulated transcript** as `recentTranscript`; the current slice is designed and verified for a short placeholder conversation.
- `portraitState` is temporarily visible in the interface for debugging purposes.
- **Engagement and Tension remain hidden** from the interface; they are code-owned state axes only.
- **Live fallback** — if the Gemini provider times out, returns a non-2xx response, produces invalid JSON, or returns schema-invalid output, the turn falls back to the deterministic scenario-owned fallback response automatically. The game remains playable.

## License

MIT
