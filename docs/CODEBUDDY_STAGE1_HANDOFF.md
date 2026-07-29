# UNSAID: Say It Again
## Credit-Efficient CodeBuddy Stage 1 Handoff

**Status:** Authoritative Stage 1 implementation brief  
**Project:** Tencent Cloud × UTM AI CAN DO IT Hackathon 2026 — Game Track  
**Baseline:** Stage 0 approved at commit `cde9586`  
**Local repository:** `C:\Tencent X UTM\Unsaid`  
**Team:** Solo developer  
**Stage 1 goal:** Turn the approved technical spine into one complete, polished, judge-ready episode without expanding the product.

---

## 1. Source of truth

This file is the current source of truth for Stage 1. It overrides older plans where they conflict with it.

The following are superseded and must not be revived:

- the Amir or “Night Before” scenario;
- the earlier M0–M6 whole-project plan;
- five endings, eight beats, Reads, Pivots, impact chips, visible meters, ladders, XP, streaks, callsigns, and 100 levels;
- multiple scenarios or a Stage 2 scenario;
- the idea that REHEARSE is available before every turn.

Stage 0 is approved. Preserve its architecture, tests, fallback behavior, and working local development path unless a Stage 1 requirement makes a small change necessary.

Before every milestone:

1. inspect the current branch and working tree;
2. preserve unrelated user changes;
3. confirm the current commit;
4. read this handoff;
5. implement only the named milestone;
6. stop after verification and wait for approval.

---

## 2. Product in one paragraph

**UNSAID** is a browser-based cinematic conversation game. Its first episode, **Say It Again**, places the player in a café with a close friend whose important event they promised to attend but skipped. The player wants forgiveness; the friend needs to know whether they mattered. At two pivotal moments, the player first **REHEARSES** a line in a flattering imagined version of the conversation, then presses **SAY** and sends the same words into the real conversation. The contrast between the response the player hoped for and the response their words actually caused is the central mechanic.

The finished Stage 1 loop is:

> Opening → five SAY turns → two REHEARSE moments → code-owned state changes → one of three outcomes → minimal reflection → replay

---

## 3. Frozen creative contract

### Scenario

- **Scenario ID:** `say-it-again`
- **Location:** one café table by a window, mid-afternoon
- **Characters on screen:** one friend
- **Relationship:** close friends for nine years
- **Incident:** the friend invited very few people to an important public event; the player promised to attend, did not go, and falsely said something came up
- **Time since incident:** three weeks
- **Player’s stated goal:** apologize and repair the friendship
- **Player’s hidden temptation:** obtain quick relief from guilt
- **Friend’s need:** learn whether they genuinely mattered to the player
- **Tone:** restrained, human, uncomfortable, never melodramatic

### Turn structure

There are exactly **five committed SAY turns**.

| SAY turn | Beat | Purpose |
|---:|---|---|
| 1 | Polite surface | Both people initially pretend the meeting is ordinary. |
| 2 | First real attempt | The first required REHEARSE/SAY moment. The player tries to apologize. |
| 3 | Actual injury | The friend makes clear that the pain was waiting and checking the door, not merely the missed event. |
| 4 | Correction | The second required REHEARSE/SAY moment. The player can respond to the right injury. |
| 5 | Close | The player sits with the consequence instead of demanding forgiveness. |

The two required rehearsal turns are **SAY turns 2 and 4**. Do not add optional rehearsal to other turns during Stage 1.

### Opening line

Use one authored opening line from the friend:

> “You said you wanted to talk.”

Small wording refinement is allowed during later story polish, but the function and tone of the line must remain the same.

### Outcomes

There are exactly three outcomes. Code selects the outcome; the model never does.

1. **Even**  
   Not forgiveness, but the conversation becomes honest and leaves something to rebuild.

2. **Smoothed**  
   The friend says it is fine, but the relationship remains politely unresolved.

3. **The Speech**  
   The player centers their own guilt so completely that the friend ends up comforting them.

Working outcome copy:

- **Even:** “Not forgiveness. Not yet. But the truth is finally between you.”
- **Smoothed:** “They say it’s fine. The untouched drink says otherwise.”
- **The Speech:** “You came to apologize. Somehow, they ended up comforting you.”

These lines may be refined later without changing the outcome meanings.

---

## 4. Frozen mechanical contract

### Emotional state

Retain the approved Stage 0 axes and bounds:

- `engagement`: `-10` to `10`
- `tension`: `-10` to `10`
- per-turn deltas: `-3` to `3`

Retain the code-owned portrait-state lookup:

- `distant`
- `defensive`
- `hurt_exposed`
- `connected`

The model may return dialogue and a bounded semantic assessment. It may not select:

- the turn number;
- the next beat;
- whether REHEARSE is available;
- the final outcome;
- accumulated axis values;
- portrait state without code verification.

### Existing intent vocabulary

Retain the approved Stage 0 intent vocabulary unless a focused migration is justified and approved:

- `acknowledge`
- `defend`
- `minimize`
- `redirect`
- `repair`
- `pressure`
- `unclear`

### Deterministic outcome evaluation

Stage 1 needs a small, explainable, code-owned outcome evaluator. It should use the five validated assessments and final accumulated emotional state.

Recommended initial rules:

- Count `repair` and `acknowledge` as repair-oriented turns.
- Count `defend`, `minimize`, `redirect`, and `pressure` as self-protective turns.
- **The Speech** if at least three turns are self-protective, or the final state is both highly tense and non-engaged.
- **Even** if at least three turns are repair-oriented, final engagement is positive, and final tension is not highly elevated.
- **Smoothed** for all remaining valid paths.

Exact threshold constants may be adjusted during Milestone 1 if tests reveal an unreachable outcome, but:

- the rules must remain deterministic and centralized;
- all three outcomes must be reachable in unit tests;
- rule changes must be reported;
- no model-selected ending is allowed.

### REHEARSE/SAY

At SAY turns 2 and 4:

1. The scene enters `rehearsing`.
2. The player writes the proposed line.
3. The game produces an immediate authored imagined response.
4. The player may edit the line while still rehearsing.
5. Pressing **SAY** commits the exact current text.
6. Reality mode resumes.
7. The committed text is sent through `/api/turn`.
8. The real response and code-owned state update appear.

The imagined response is deterministic and local. It does not call the live model, mock model, or server.

No numerical meter, intent label, impact chip, or coaching tooltip appears in the final scene.

---

## 5. Technical boundaries inherited from Stage 0

Preserve these separations:

- UI does not know the model provider.
- HTTP route handles HTTP concerns.
- Turn service assembles input, validates output, and falls back safely.
- Adapter performs inference only.
- Reducer owns legal state transitions.
- Scenario data owns content, turn structure, opening, rehearsal points, and outcome metadata.
- Outcome evaluator is deterministic and code-owned.
- Runtime credentials remain server-side.
- Model output is never rendered as HTML.
- Every inference, parsing, validation, timeout, or network failure becomes a playable fallback or recoverable state.

Do not replace React, TypeScript, Vite, Zustand, Zod, or the existing Node/Express development server.

Do not refactor working Stage 0 code merely for naming or style.

---

## 6. Stage 1 must ship

Stage 1 contains only:

1. One data-driven `say-it-again` scenario.
2. One five-turn playable conversation.
3. Two required REHEARSE/SAY moments.
4. One friend character.
5. Four portrait states.
6. Three deterministic outcomes.
7. One live model adapter through the existing provider boundary.
8. Existing mock adapter for local development and tests.
9. A deterministic recorded-run or cached fallback for demo safety.
10. One final café composition with restrained animation.
11. A minimal after-action reflection containing:
    - outcome;
    - one quoted player line;
    - one short explanation of why it mattered.
12. Replay from the beginning.
13. Public deployment.
14. Desktop polish and mobile playability.

Target final art count: approximately **10–12 finished images**:

- four portrait states × two mouth frames = 8;
- one blink/rest variant;
- one café background;
- up to two optional cinematic stills only if the schedule remains green.

---

## 7. Explicitly out of scope

Do not build or reintroduce:

- Amir or “The Night Before”;
- a second scenario;
- multiple NPCs;
- more than five SAY turns;
- more than three outcomes;
- rehearsal on every turn;
- Reads, Pivots, impact chips, visible meters, numerical scores, ladders, XP, streaks, badges, callsigns, level select, or daily challenges;
- accounts, authentication, database, cloud save, admin dashboard, multiplayer, analytics service, or peer comparison;
- voice input, speech-to-text, dynamic TTS, RTC, Live2D, 3D, Unity, Godot, or native mobile apps;
- localization;
- a generic design system;
- speculative plugin or provider abstractions;
- an AI-generated end report;
- Stage 2 planning or implementation.

Any proposed scope change must stop the milestone and be discussed with the creator first.

---

## 8. Stage 1 milestones

### Milestone 0 — Scope freeze and handoff

**Owner:** Codex + creator  
**Status:** represented by this approved file  
**CodeBuddy cost:** zero

Deliverables:

- freeze the scenario, five-turn structure, two rehearsal points, three outcomes, technical boundaries, milestone sequence, and exclusions;
- produce the first CodeBuddy prompt;
- do not modify application code.

Acceptance:

- the creator approves this file before CodeBuddy starts Stage 1 implementation.

### Milestone 1 — Scenario engine

**Primary tool:** CodeBuddy  
**Goal:** replace placeholder progression with a data-driven five-turn episode and deterministic endings, while keeping the existing mock path.

Required work:

- represent `say-it-again` as scenario data rather than component constants;
- add the opening line, five beats, turn budget, rehearsal-turn metadata, outcome metadata, and fallback content;
- add a small code-owned progress engine;
- add a centralized deterministic outcome evaluator;
- wire the current placeholder UI just enough to:
  - start from the authored opening;
  - stop accepting input after five committed turns;
  - display a plain debug outcome;
  - restart cleanly;
- preserve Stage 0 adapter, validation, reducer, fallback, and portrait behavior;
- add focused tests.

Acceptance:

- exactly five committed turns lead to exactly one outcome;
- all three outcomes are reachable with deterministic test sequences;
- the model cannot select the outcome or advance turns;
- restart returns all state and transcript data to the scenario seed;
- malformed output and thrown inference still produce the existing playable fallback;
- type-check, tests, and build pass.

Not in Milestone 1:

- no REHEARSE UI or imagined-response logic;
- no live provider;
- no final story prompt;
- no final art, audio, animation, or styling;
- no after-action reflection beyond a plain debug outcome;
- no deployment work.

### Milestone 2 — REHEARSE/SAY loop

**Primary tool:** CodeBuddy  
**Goal:** implement the signature mechanic with placeholders and deterministic imagined responses.

Required work:

- explicit scene modes such as `reality`, `rehearsing`, `imagined-response`, `submitting`, and `outcome`;
- mandatory rehearsal at SAY turns 2 and 4 only;
- local authored imagined-response selection;
- editable rehearsal line before commit;
- SAY commits the exact current line once;
- prevent duplicate submission and turn advancement;
- return to a recoverable rehearsal state after a client/network failure;
- simple CSS mode distinction only; final cinematic transition waits for Milestone 4.

Acceptance:

- a complete five-turn placeholder run contains exactly two rehearsal phases;
- rehearsal performs no `/api/turn` call;
- SAY performs exactly one `/api/turn` call with the committed text;
- failures do not consume a turn or erase the rehearsed line;
- keyboard and button paths work;
- tests, type-check, and build pass.

### Milestone 3 — Live AI integration

**Primary tool:** CodeBuddy  
**Goal:** connect one approved runtime model through the existing adapter boundary.

Required work:

- one live adapter selected after credentials and provider access are confirmed;
- server-side environment configuration;
- scenario/persona prompt construction;
- structured output validation;
- timeout, one bounded retry where appropriate, and deterministic fallback;
- a small evaluation corpus covering repair, acknowledgment, minimizing, defensiveness, pressure, and ambiguous input;
- keep mock mode as the default local/test path unless explicitly configured.

Acceptance:

- secrets remain server-side and absent from committed files/frontend bundles;
- live responses follow the schema;
- the evaluation corpus meets the agreed classification threshold;
- malformed output, timeout, provider failure, and missing credentials remain playable;
- the default demo can be switched back to mock/recorded mode without code edits;
- tests, type-check, and build pass.

### Milestone 4 — Visual scene production

**Primary tool:** Codex + visual tools  
**Goal:** make the café conversation cinematic without changing the engine.

Required work:

- final café composition;
- one consistent character with four portrait states;
- aligned mouth/blink variants;
- reality and rehearsal grades;
- clear color-drain and snap-back transition;
- restrained breathing, blink, response, and camera motion;
- responsive desktop/mobile composition;
- accessible focus, contrast, reduced-motion behavior, and readable text.

Acceptance:

- the mode is unmistakable without a text label;
- portrait swaps do not visibly jump;
- conversation remains readable at desktop and common phone widths;
- reduced-motion mode remains fully usable;
- no animation blocks input or turn recovery;
- production build passes.

### Milestone 5 — Outcomes and demo safety

**Primary tool:** CodeBuddy for logic; Codex for presentation  
**Goal:** complete the ending/reflection loop and make the demo resilient.

Required work:

- present all three endings;
- select one evidence quote deterministically from the transcript;
- show one concise explanation;
- replay/reset flow;
- create a deterministic recorded-run or cached adapter;
- graceful live-to-recorded recovery;
- no fabricated live-AI claim when recorded mode is active.

Acceptance:

- every outcome is reachable and visually distinct;
- the evidence quote comes from the actual current transcript;
- a failed live call cannot strand the demo;
- replay starts a clean attempt;
- the active adapter/mode is auditable in development;
- tests, type-check, and build pass.

### Milestone 6 — Deployment and final QA

**Primary tool:** Codex; CodeBuddy only for a tightly scoped deployment bug  
**Goal:** freeze and ship the public demo.

Required work:

- deploy the approved commit;
- verify desktop and mobile;
- verify load, API, fallback, rehearsal, endings, replay, and recorded mode;
- performance and accessibility pass;
- final README;
- screenshots and short demo recording;
- preserve/export CodeBuddy milestone histories;
- tag or record the final checkpoint.

Acceptance:

- public URL works on desktop and a real phone;
- a complete five-turn run works in live and demo-safe modes;
- no secrets or debug-only controls are exposed in production;
- type-check, all tests, and production build pass from a clean install;
- final scope matches this handoff.

---

## 9. Credit policy

The recent CodeBuddy rounds cost approximately 30 and 38 credits, compared with roughly 10 credits earlier. The remaining balance is healthy, but it is not permission to use broad prompts.

- Use a fresh CodeBuddy chat for every milestone.
- Keep Max mode off.
- Prefer Balanced for architecture and implementation.
- Use Fast only for genuinely mechanical corrections.
- Never paste all historical planning documents into CodeBuddy. Give it this handoff and the repository.
- Do not ask CodeBuddy to plan or implement multiple milestones in one run.
- Do not request a rewrite when a focused extension will work.
- Do not create subagents unless the creator explicitly requests them.
- Stop after the named milestone.
- If blocked, report the exact command, error, and files involved before escalating effort.

At the end of each milestone, report only:

1. files changed;
2. important implementation decisions;
3. commands run and exact results;
4. manual smoke-test evidence;
5. commit SHA and push result;
6. remaining blockers;
7. recommended next prompt.

---

## 10. First CodeBuddy prompt

Use the separate file `CODEBUDDY_STAGE1_M1_PROMPT.md`, or copy this exact prompt:

```text
Continue UNSAID from the approved Stage 0 commit cde9586 in the current
repository.

Read @docs/CODEBUDDY_STAGE1_HANDOFF.md completely, inspect the current workspace,
and implement Stage 1 Milestone 1 — Scenario Engine only.

Do not begin Milestone 2 or any later milestone. Do not implement REHEARSE/SAY,
live AI, final prompts, final art, audio, cinematic styling, deployment, or any
superseded feature.

Requirements:
1. Preserve the approved Stage 0 adapter, validation, reducer, fallback, and
   portrait behavior.
2. Represent the `say-it-again` episode as data, including the authored opening,
   five beats, five-turn budget, rehearsal-turn metadata for turns 2 and 4,
   three outcome definitions, and fallback content.
3. Add the smallest code-owned progress engine needed for exactly five committed
   turns.
4. Add a centralized deterministic outcome evaluator. The model must never
   choose the outcome or advance the turn.
5. Wire the existing placeholder UI only enough to start with the authored
   opening, stop after turn five, show a plain debug outcome, and restart cleanly.
6. Add focused tests proving all three outcomes are reachable, turn progression
   is code-owned, the sixth submission is blocked, restart restores the seed,
   and existing malformed/thrown-error fallbacks remain playable.
7. Avoid broad refactors, new libraries, generic abstractions, and unrelated
   cleanup.

Run:
- npm run type-check
- npm run test
- npm run build

Then manually smoke-test one five-turn mock conversation and restart.

Commit and push the milestone. Report only:
- files changed;
- any outcome thresholds chosen or changed;
- verification results;
- the five-turn smoke-test inputs, portrait labels, and final outcome;
- commit SHA and push result;
- remaining blockers.

Stop and wait for approval.
```

---

## 11. Approval gates

A CodeBuddy completion report is not automatic approval.

After each milestone:

1. compare the new commit with the previously approved commit;
2. inspect the exact diff;
3. independently run type-check, tests, and build;
4. reproduce the critical manual behavior;
5. verify the handoff exclusions;
6. approve, reject, or issue one smallest corrective milestone.

Do not plan or start the next milestone until the current one is approved.

---

## 12. Stage 1 definition of done

Stage 1 is done when a judge can open one public URL and, without explanation:

- understand that they are meeting a hurt friend in a café;
- complete five real conversation turns;
- experience two unmistakable REHEARSE/SAY contrasts;
- see the character react through dialogue and portrait state;
- reach one of three meaningful endings;
- read one piece of evidence quoted from their own words;
- replay safely;
- continue even if the live model fails.

The result should feel like one small finished game, not a platform, chatbot, dashboard, or prototype collection.
