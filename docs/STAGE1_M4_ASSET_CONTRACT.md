# UNSAID — Stage 1 Milestone 4 Asset Contract

**Version:** 1.1 (Milestone 4A rebuild — feat/stage1-m4-cinematic-shell-v2)  
**Status:** Awaiting final artwork  
**Author:** Stage 1 implementation team  

---

## Overview

This document defines every asset the Milestone 4A cinematic shell expects.  
Artwork is integrated by dropping correctly-sized files into `public/assets/`.  
No code change is required when final art arrives.

---

## 1. Scene Background

### `public/assets/cafe/cafe-window-afternoon.webp`

| Property | Specification |
|----------|--------------|
| Dimensions | **1920 × 1080 px** minimum; 2560 × 1440 px preferred |
| Orientation | Landscape |
| Transparency | None — fully opaque |
| Color mode | sRGB |
| Crop | Safe subjects within central 80 % of width |
| Background position | `center 30%` (top-weighted to show window light) |
| Background size | `cover` |
| File size guidance | ≤ 400 KB after WebP compression (quality ≈ 82) |
| Content | Café interior, afternoon window light from behind/above subject, warm neutral tones, shallow depth of field. Subject area must be center-bottom. |

**Safe areas:**

```
┌──────────────────────────────────┐
│  ░░░░░░░░ window light ░░░░░░░░  │ 0–40% height
│                                  │
│         [ subject zone ]         │ 10–100% height, 20–80% width
│                                  │
│  ████████ table foreground █████ │ 72–100% height (blended by foreground asset)
└──────────────────────────────────┘
```

---

### `public/assets/cafe/table-foreground.webp`

| Property | Specification |
|----------|--------------|
| Dimensions | **1920 × 540 px** |
| Orientation | Landscape |
| Transparency | Yes — alpha channel required; top edge must fade to fully transparent |
| Color mode | sRGB + Alpha |
| Crop | Full width; covers bottom 28 % of viewport |
| File size guidance | ≤ 80 KB |
| Content | Café table surface, edge of coffee cups, soft foreground blur. Top 30 % of asset must be transparent to blend with background. |

---

## 2. Friend Portrait — Frame Specification

### Canvas and position

| Property | Desktop | Mobile |
|----------|---------|--------|
| Frame width | `min(380 px, 40 vw)` | `min(220 px, 65 vw)` |
| Frame height | 90 % of scene stage height | 90 % of scene stage height |
| Horizontal position | Horizontally centred in scene stage | Horizontally centred |
| Vertical anchor | Bottom of frame = bottom of scene stage | Same |
| `object-fit` | `contain` | `contain` |
| `object-position` | `bottom center` | `bottom center` |

### Artwork canvas size (source files)

| Property | Specification |
|----------|--------------|
| Canvas | **800 × 1200 px** |
| Subject fill | Character occupies roughly 65–85 % of canvas height |
| Head room | 40–80 px above head to top of canvas |
| Bottom edge | Character feet or lower torso at bottom 5 px of canvas |
| Horizontal centering | Character horizontally centered within canvas |
| Background | Fully transparent |
| Colour mode | sRGB + Alpha |
| File size guidance | ≤ 150 KB per frame (quality ≈ 85) |

### Eye and head anchors (for future blink/lip sync alignment)

All measurements are from **top-left of the 800 × 1200 canvas**.

| Anchor | Expected approximate position |
|--------|------------------------------|
| Eye midpoint | (400, 280–340) depending on posture |
| Chin | (400, 420–480) |
| Crown | (400, 180–240) |
| Left eye center | (330–370, 280–320) |
| Right eye center | (430–470, 280–320) |

Exact values are recorded per-state in the companion onion-skin layer (see §5).

---

## 3. Portrait State Files

Each portrait state has three files: **closed mouth**, **open mouth** (speaking), and a shared **blink** frame.

### File list

```
public/assets/friend/
  distant-closed.webp        ← state: distant,      mouth: closed
  distant-open.webp          ← state: distant,      mouth: open
  defensive-closed.webp      ← state: defensive,    mouth: closed
  defensive-open.webp        ← state: defensive,    mouth: open
  hurt_exposed-closed.webp   ← state: hurt_exposed, mouth: closed
  hurt_exposed-open.webp     ← state: hurt_exposed, mouth: open
  connected-closed.webp      ← state: connected,    mouth: closed
  connected-open.webp        ← state: connected,    mouth: open
  blink.webp                 ← shared blink frame (eyes closed, neutral expression)
```

### State visual descriptions

| State | Posture | Expression | Lighting suggestion |
|-------|---------|------------|---------------------|
| `distant` | Upright, slight lean back | Neutral, guarded | Even, cool |
| `defensive` | Slightly turned away, arms implied closed | Tight, closed off | Cooler, slight shadow |
| `hurt_exposed` | Slightly forward, shoulders dropped | Vulnerable, raw | Warmer, softer |
| `connected` | Relaxed, slight lean forward | Open, present | Warmest, gentle window fill |

### Onion-skin alignment rules

All nine frames **must be painted on the same 800 × 1200 canvas** and **must share:**

1. **Eye midpoint within ±4 px** vertically and horizontally across all non-blink frames.
2. **Crown height within ±8 px** across all states.
3. **Chin position within ±12 px** (posture changes may shift chin slightly).
4. **Body width within ±20 px** at shoulder level.
5. The `blink.webp` frame must match the `distant-closed.webp` eye position exactly.

Provide the master PSD/Procreate file with:
- a locked "alignment guide" layer at the top showing eye/chin/crown rules,
- each portrait state as a named layer group,
- the blink frame as a separate top-level group.

---

## 4. Format and Delivery

| Property | Requirement |
|----------|-------------|
| Format | WebP (lossy for opaque; WebP with alpha for transparent) |
| Color profile | sRGB IEC61966-2.1 |
| Naming | Exact filenames as listed above — lowercase, underscores only in state names |
| Delivery location | `public/assets/cafe/` and `public/assets/friend/` |
| Integration method | Drop files in place — no code change required |

### Compression guidance

| Asset | Max file size | Quality setting |
|-------|--------------|----------------|
| `cafe-window-afternoon.webp` | 400 KB | ≈ 82 |
| `table-foreground.webp` | 80 KB | ≈ 85 |
| Portrait frames (×9) | 150 KB each | ≈ 85 |

---

## 5. Desktop / Mobile Behaviour

| Viewport | Background | Portrait frame | Notes |
|----------|------------|---------------|-------|
| ≥ 900 px wide (desktop) | `cover`, `center 30%` | `min(380px, 40%)` wide | Scene stage ≈ 72 % of viewport height |
| < 600 px wide (mobile) | `cover`, `center 30%` | `min(220px, 65%)` wide | Scene stage ≈ 58 % of viewport height; dialogue card narrows |

Both layouts use `object-fit: contain` and `object-position: bottom center` so the character always anchors at the bottom regardless of frame size.

---

## 6. Placeholder Behaviour (before artwork)

While artwork files are absent, the shell renders an intentional silhouette placeholder:

- Dark rounded oval representing the character's body silhouette
- Subtle lighter oval at the top for the head
- Color tinted per portrait state (cool blue-grey for distant, warm amber-grey for connected, etc.)
- Gentle breathing animation driven by CSS keyframes
- No broken-image icons — portrait `<img>` elements are hidden until artwork files are present

The placeholder is visually intentional and does **not** display the state name or any debug label.

---

## 7. What This Contract Does NOT Cover

- Miora character design (out of scope for Stage 1)
- Voice or audio assets
- Animated sprite sheets
- Additional scene locations (Stage 2+)
- Final colour grading of background photography
