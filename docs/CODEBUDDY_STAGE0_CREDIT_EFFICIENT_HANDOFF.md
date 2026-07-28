# UNSAID: Say It Again
## Credit-Efficient CodeBuddy Stage 0 Handoff

**Status:** Current implementation brief  
**Project:** Tencent Cloud × UTM AI CAN DO IT Hackathon 2026 — Game Track  
**Team:** Solo developer  
**Priority:** Build a small, reliable architectural skeleton that can be expanded and visually polished later.

---

## 1. Product in one paragraph

**UNSAID** is a browser-based cinematic conversation game. Its first episode, **Say It Again**, places the player in a difficult café apology with a close friend. At two pivotal moments, the player enters **REHEARSE** mode, chooses what they secretly hope the apology will achieve, and writes what they plan to say. The game shows an authored imagined response. When the player presses **SAY**, reality returns and an AI-driven character responds to the same words. The contrast between the response the player wanted and the response their words actually caused is the central mechanic.

Stage 0 is not the finished episode. It is the reusable technical spine that proves one complete turn:

> Player message → server-side model call → validated structured response → deterministic state update → visible UI change → safe fallback

---

## 2. Non-negotiable decisions

- Web-native game; no Unity, Godot, Live2D, or 3D engine.
- React + TypeScript + Vite.
- Zustand for client game state.
- Zod for runtime validation.
- Framer Motion and CSS may be installed, but Stage 0 needs only restrained placeholder transitions.
- Runtime AI credentials must remain server-side and must never be exposed in client code.
- The language-model provider must sit behind a small adapter interface so it can be replaced later.
- AI may generate dialogue and semantic assessment, but code owns:
  - allowed state ranges;
  - clamping;
  - turn progression;
  - ending selection;
  - safety and fallback behavior.
- Scenario content must be data-driven so future episodes can reuse the same engine.
- The two hidden emotional axes are:
  - `engagement`: withdrawn ↔ actively present;
  - `tension`: calm ↔ emotionally pressured.
- The player must not see numerical meters in the final experience.
- CodeBuddy should create the core architecture and first functioning AI loop. Later visual expansion and polish may be completed with other development tools.

---

## 3. Stage 0 scope

Build only the following:

1. A minimal single-screen conversation scene using placeholder blocks or temporary images.
2. A text input and submit action.
3. A server-side `POST /api/turn` endpoint.
4. A provider-neutral `ModelAdapter` interface.
5. One development adapter that can run without paid external inference.
6. One live adapter boundary that can be connected later through environment variables.
7. A Zod schema for the model response.
8. A deterministic reducer that applies bounded state changes.
9. A fallback response when inference, parsing, validation, or networking fails.
10. A minimal turn transcript and visible portrait-state label for debugging.
11. Focused tests for validation, clamping, and fallback behavior.
12. A README with exact local setup and test commands.

The mock development path is intentional. Stage 0 must run before a runtime model provider is chosen.

---

## 4. Explicitly out of scope

Do **not** build these yet:

- final story script;
- final artwork, character animation, voiceover, music, or sound design;
- account system, database, analytics, multiplayer, inventory, map, or level select;
- multiple episodes or multiple endings;
- the complete REHEARSE → SAY cinematic transition;
- visible scoring bars, impact chips, “Reads,” ladders, badges, or coaching dashboards;
- elaborate design system or generic component library;
- deployment-specific infrastructure before the local vertical slice works;
- speculative abstractions that are not needed by the Stage 0 acceptance criteria.

Do not reintroduce the former Amir/software-engineering scenario or its superseded systems.

---

## 5. Required domain contract

Use a compact contract similar to the following. Improve names only when there is a concrete technical reason.

```ts
type PortraitState =
  | "distant"
  | "defensive"
  | "hurt_exposed"
  | "connected";

type TurnRequest = {
  scenarioId: string;
  turnIndex: number;
  playerText: string;
  state: {
    engagement: number;
    tension: number;
  };
  recentTranscript: Array<{
    speaker: "player" | "character";
    text: string;
  }>;
};

type TurnResponse = {
  characterText: string;
  assessment: {
    intent:
      | "acknowledge"
      | "defend"
      | "minimize"
      | "redirect"
      | "repair"
      | "pressure"
      | "unclear";
    engagementDelta: number;
    tensionDelta: number;
  };
  presentation: {
    portraitState: PortraitState;
  };
};
```

Validation rules:

- reject empty or excessively long player input;
- keep model deltas within a small configured range;
- clamp accumulated state to configured bounds;
- never trust a model-selected ending or turn number;
- never render model-provided HTML;
- return a stable, typed error shape where appropriate;
- convert every inference or validation failure into a playable fallback turn.

---

## 6. Architectural boundaries

Keep the file structure small. A reasonable starting shape is:

```text
src/
  components/
    ConversationScene.tsx
  game/
    scenario.ts
    state.ts
    types.ts
  lib/
    turnClient.ts
server/
  adapters/
    ModelAdapter.ts
    MockModelAdapter.ts
  turn/
    prompt.ts
    schema.ts
    service.ts
    route.ts
tests/
docs/
```

The exact server runner may differ, but preserve these separations:

- UI does not know the model provider.
- Route handles HTTP concerns.
- Service assembles model input, validates output, and falls back safely.
- Adapter performs inference only.
- Reducer owns legal game-state transitions.
- Scenario data owns content, starting state, and constraints.

Avoid framework churn. If Vite alone cannot expose the endpoint, add the smallest maintainable Node development server rather than replacing the agreed frontend stack.

---

## 7. Stage 0 acceptance criteria

Stage 0 is complete only when all of the following are true:

- `npm install` and the documented development command start the project.
- The browser presents one readable conversation screen.
- Submitting a message produces a character response through `/api/turn`.
- The default local path works without a paid API key.
- A valid response changes Engagement and/or Tension through code-owned logic.
- The debug portrait state changes according to the accumulated axes.
- Malformed mock output triggers the fallback without breaking the scene.
- Network failure triggers the fallback or a recoverable retry state.
- Secrets are absent from frontend bundles and committed source.
- Type-check, tests, and production build pass.
- The README explains files changed, commands, environment variables, and known limits.

---

## 8. Credit policy

CodeBuddy credits are limited. Follow these rules:

- Keep **Max mode off**.
- Use **Balanced (0.59×)** for normal planning and implementation.
- Use **Fast (0.34×)** only for genuinely mechanical, tightly scoped edits.
- Do not use Default or Deep (2.20×) for scaffolding, CSS, documentation, or routine fixes.
- Escalate one specific blocker to Primary or Deep only after:
  1. the failing command and error are captured;
  2. the relevant files are named;
  3. one focused Balanced attempt has failed.
- Do not ingest the full hackathon chat or all planning documents. This handoff is the current implementation source of truth.
- Use a fresh chat for each milestone so old conversational context does not keep increasing consumption. Begin each chat by referencing this handoff and the current workspace.
- Keep responses concise. Prefer editing files and running checks over reproducing complete files in chat.
- Do not create subagents for Stage 0 unless explicitly requested.
- Do not expand scope without asking.
- At the end of every milestone, report only:
  - files changed;
  - commands run and their results;
  - remaining blocker;
  - recommended next prompt.

Suggested allocation of the available balance:

| Work | Maximum share |
|---|---:|
| Planning and scaffold | 15% |
| Core endpoint, adapter, schema, fallback | 30% |
| Client state and vertical-slice UI | 20% |
| Tests and one debugging pass | 15% |
| Early deployment/integration | 10% |
| Untouched final reserve | 10% |

These are spending ceilings, not targets. Unused credits stay reserved.

---

## 9. Milestones

### Milestone 0 — Inspect and plan

- Read this file.
- Inspect the current workspace.
- Identify conflicts with the brief.
- Propose the smallest exact implementation plan.
- Do not modify files.

### Milestone 1 — Scaffold and contracts

- Create or validate the Vite React TypeScript project.
- Add only required dependencies.
- Implement domain types, Zod schema, state reducer, scenario seed, and mock adapter.
- Add focused unit tests.

### Milestone 2 — Complete local AI turn

- Implement `/api/turn`.
- Connect the service, mock adapter, validation, and deterministic fallback.
- Exercise valid, malformed, and failed inference paths.

### Milestone 3 — Browser vertical slice

- Implement the minimal conversation scene.
- Connect it to the endpoint and Zustand store.
- Show transcript, loading/retry behavior, and a temporary portrait-state label.
- Verify one complete 3–5 turn placeholder conversation.

### Milestone 4 — Verify and checkpoint

- Run type-check, tests, and production build.
- Remove dead code and exposed secrets.
- Update README.
- Create a clean checkpoint/commit.
- Export the CodeBuddy conversation history.

Stop after each milestone and wait for approval.

---

## 10. First prompt to send in CodeBuddy

Open a new project folder, place this file at `docs/CODEBUDDY_STAGE0_CREDIT_EFFICIENT_HANDOFF.md`, select **Balanced**, leave **Max mode off**, select **Plan** or **Ask** mode, and send:

```text
Read @docs/CODEBUDDY_STAGE0_CREDIT_EFFICIENT_HANDOFF.md and inspect the current
workspace. We have a strict credit budget.

Perform Milestone 0 only. Do not create, edit, install, or delete anything yet.
Return:
1. the smallest proposed architecture;
2. the exact files Milestone 1 would create or modify;
3. up to five concrete risks or missing decisions;
4. the exact verification commands.

Keep the response under 600 words. Do not restate the product brief. Do not
propose out-of-scope features. Stop and wait for approval.
```

After reviewing its plan, approve only Milestone 1. Do not ask CodeBuddy to “build the whole game.”

---

## 11. Evidence for the submission

Preserve proof of meaningful CodeBuddy use:

- keep each milestone conversation focused and clearly named;
- export every milestone history, then preserve a final review history before submission;
- retain checkpoints or commits for each milestone;
- record which core files CodeBuddy created and which later work was extended elsewhere;
- capture screenshots of the working AI turn, fallback behavior, and deployment;
- describe CodeBuddy’s actual architectural and debugging contributions honestly.

The goal is not to burn credits. The goal is to make CodeBuddy’s contribution central, demonstrable, and technically meaningful.
