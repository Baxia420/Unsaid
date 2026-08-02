# Stage 1 Milestone 4 — Asset Contract

## Overview

This document defines the exact visual asset requirements for the UNSAID cinematic café scene. All assets are optional during development; the scene renders gracefully with CSS placeholders. Final artwork must be delivered to the paths below before Milestone 6 (Final Art Integration).

---

## Background Assets

### `public/assets/cafe/cafe-window-afternoon.webp`

| Property | Requirement |
|----------|-------------|
| **Pixel dimensions** | 1920 x 1080 (minimum) |
| **Aspect ratio** | 16:9 |
| **Transparency** | No (opaque background) |
| **Preferred format** | WebP (lossy, quality 85-90) |
| **Maximum file size** | 400 KB |
| **Mobile behavior** | CSS `object-fit: cover` crops center; safe area must tolerate 20% edge crop |
| **Safe area** | Primary visual interest within 1540 x 860 centered region (80% of width/height) |
| **Crop tolerance** | 10% on all edges acceptable |
| **Color treatment** | Cool, slightly desaturated; mid-afternoon daylight through window; muted browns and greys |
| **Content** | Quiet café interior; table surface visible at bottom third; window with soft daylight in upper left; negative space for portrait placement in right half |
| **Onion-skin alignment** | Portrait anchor point (see below) must align with empty space in right half of background |

### `public/assets/cafe/table-foreground.webp` (Optional)

| Property | Requirement |
|----------|-------------|
| **Pixel dimensions** | 1920 x 400 |
| **Aspect ratio** | 4.8:1 |
| **Transparency** | Yes — alpha channel for table edge and drink placement |
| **Preferred format** | WebP (lossy with alpha, quality 85) |
| **Maximum file size** | 150 KB |
| **Mobile behavior** | Hide below 640px viewport width; or scale to 50% height |
| **Content** | Table surface edge, possible drink silhouette, shallow depth-of-field blur |
| **Anchor** | Bottom-aligned; table edge at top of image |

---

## Portrait Assets

All portrait assets share the following base requirements:

| Property | Requirement |
|----------|-------------|
| **Pixel dimensions** | 512 x 768 (minimum); 1024 x 1536 (preferred) |
| **Aspect ratio** | 2:3 (portrait) |
| **Transparency** | Yes — alpha channel for hair and shoulder edges |
| **Preferred format** | WebP (lossy with alpha, quality 88) |
| **Maximum file size** | 250 KB per frame |
| **Mobile behavior** | Downscale to 50% on viewports below 640px; maintain crisp edges |
| **Character anchor point** | Center of face at 50% horizontal, 35% vertical from top |
| **Head alignment** | Eyes at 30% from top of frame |
| **Eye alignment** | Horizontal center line at 30% from top |
| **Safe area** | Face must remain visible when cropped to 1:1 square from center-top |
| **Crop tolerance** | 15% from bottom; 10% from sides; 5% from top |
| **Onion-skin alignment** | All frames must align pixel-perfect when stacked; use same canvas size and anchor point |

### Expression States — Closed Mouth

| Filename | Emotional State | Visual Notes |
|----------|----------------|--------------|
| `public/assets/friend/distant-closed.webp` | Distant, guarded | Slightly averted gaze; neutral mouth; cooler skin tone |
| `public/assets/friend/defensive-closed.webp` | Defensive, walled | Tense jaw; narrowed eyes; closed posture |
| `public/assets/friend/hurt_exposed-closed.webp` | Hurt, vulnerable | Softened eyes; slight tremor; warmer undertone |
| `public/assets/friend/connected-closed.webp` | Connected, open | Relaxed features; direct or soft gaze; warmest tone |

### Expression States — Open Mouth

| Filename | Emotional State | Visual Notes |
|----------|----------------|--------------|
| `public/assets/friend/distant-open.webp` | Distant, speaking | Same face structure as closed; mouth slightly open; minimal expression change |
| `public/assets/friend/defensive-open.webp` | Defensive, speaking | Same as defensive-closed; mouth open; tension remains in eyes |
| `public/assets/friend/hurt_exposed-open.webp` | Hurt, speaking | Same as hurt_exposed-closed; mouth open; vulnerability maintained |
| `public/assets/friend/connected-open.webp` | Connected, speaking | Same as connected-closed; mouth open; warmth maintained |

### Blink Frame

| Filename | Purpose | Visual Notes |
|----------|---------|--------------|
| `public/assets/friend/blink.webp` | Blink animation | Eyes fully closed; all other features match neutral-closed state; duration 80-120ms in animation |

**Blink behavior**: The blink frame is overlaid at low opacity (15%) during the blink animation cycle. It must align perfectly with the closed-mouth frames.

---

## Outcome Stills (Optional)

### `public/assets/stills/outcome-even.webp`

| Property | Requirement |
|----------|-------------|
| **Pixel dimensions** | 1920 x 1080 |
| **Aspect ratio** | 16:9 |
| **Transparency** | No |
| **Preferred format** | WebP (quality 90) |
| **Maximum file size** | 300 KB |
| **Content** | Neutral café ending; two figures at comfortable distance; ambiguous but not hostile |
| **Color treatment** | Neutral; neither warm nor cool dominant |

### `public/assets/stills/outcome-smoothed.webp`

| Property | Requirement |
|----------|-------------|
| **Pixel dimensions** | 1920 x 1080 |
| **Aspect ratio** | 16:9 |
| **Transparency** | No |
| **Preferred format** | WebP (quality 90) |
| **Maximum file size** | 300 KB |
| **Content** | Warmer ending; slight lean toward connection; soft focus background |
| **Color treatment** | Warm; slightly golden hour feel; subtle hope |

---

## Asset Loading Behavior

1. **Missing assets**: The scene must not crash. CSS placeholders render for all missing images.
2. **Loading priority**: Background loads first, then portrait, then foreground, then stills.
3. **Lazy loading**: Outcome stills load only when outcome state is reached.
4. **Error handling**: Failed image loads are silently ignored; placeholder remains visible.

---

## Delivery Checklist

- [ ] `cafe-window-afternoon.webp`
- [ ] `table-foreground.webp` (optional)
- [ ] `distant-closed.webp`
- [ ] `distant-open.webp`
- [ ] `defensive-closed.webp`
- [ ] `defensive-open.webp`
- [ ] `hurt_exposed-closed.webp`
- [ ] `hurt_exposed-open.webp`
- [ ] `connected-closed.webp`
- [ ] `connected-open.webp`
- [ ] `blink.webp`
- [ ] `outcome-even.webp` (optional)
- [ ] `outcome-smoothed.webp` (optional)
