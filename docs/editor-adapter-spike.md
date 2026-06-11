# Timeline-editor adapter spike — findings and gap list

The downstream consumer is a row-based timeline editor (Remotion-backed today) whose composition format we convert from. It is referred to generically throughout.

**Date:** 2026-06-11 · **Status:** complete · **Spike code:** `tools/spike-editor-adapter/convert.mjs` (throwaway — the deliverable is this document)

## What was done

Two real editor templates (`full-templates/example-5.json` — 10 overlays: 3 remote videos, 6 texts, 1 sound; `full-templates/example-7.json` — 6 overlays: 1 remote image, 5 texts) were converted to motionforge scenes with a ~350-line throwaway converter, validated with `validateScene()`, and rendered end-to-end through the golden harness browser:

- **example-7**: 203 frames @ 1280×720 → MP4 in ~1.9 s. Letter-by-letter text reveal over a padded/framed photo reproduces faithfully (system-font fallback instead of Bungee Inline).
- **example-5**: 124 frames @ 1280×720 → MP4 (**avc + aac**) in ~14.3 s — dominated by fetching ~3 HD/UHD pexels source videos; per-frame render cost is ~3 ms. Frame-accurate video decode, text composited on top, soundtrack mixed into the export.

**Both templates convert 10/10 and 6/6 overlays with zero validation errors.** The scene model (frames, `from`/`duration`, absolute positioning, keyframe animations) maps onto the editor's overlay model with no structural friction.

## Editor semantics the adapter must encode (verified in its source)

| Editor concept | semantics | motionforge mapping |
|---|---|---|
| `row` | container `zIndex = 100 − row·10` (lower row = on top); `styles.zIndex` is *within* the container, effectively constant per type in practice | sort overlays back-to-front by row (descending) → node paint order |
| `left/top/width/height` | absolute px on the composition canvas | `position: absolute` + px values |
| `rotation` | degrees, `transformOrigin: center center` | `transform: rotate(Ndeg)` (origin center is the default) |
| `from`/`durationInFrames` | Remotion `<Sequence>` | node `from`/`duration` — identical semantics |
| enter/exit animations | named templates, 15-frame ramps via `interpolate()` (`templates/animation-templates.ts`) | compiled to keyframes on the node's local timeline; see coverage below |
| units | `fontSize: "3rem"`, `letterSpacing: "-0.03em"`, `lineHeight: "1.1"` strings, empty-string style values | adapter normalizes: rem→×16, em→×fontSize, ""→absent |
| `fontFamily` | CSS class names (`font-bungee-inline`, `font-league-spartan`, `font-sans`) loaded via @fontsource | needs a **font manifest** (class → family + woff2 URL) registered as scene font assets |
| `TemplateOverlay` vs `CompositionData` | templates carry `aspectRatio` + `duration`; compositions carry `width/height/fps/durationInFrames` | adapter accepts both envelopes |

## Gap list (classified)

### Engine work (ordered by measured frequency in real templates)

1. **CSS `filter` chains** — `brightness/contrast/saturate/sepia/hue-rotate/grayscale` (+`blur` in the editor UI). Used by **13 of 20** video overlays across the full templates; it's how the editor does color grading. Canvas2D `ctx.filter` supports exactly this grammar in Chromium. *Top engine priority.*
2. **`zIndex` style property** — adapter handles ordering today by sorting, but explicit `zIndex` makes agent patches ("move behind X") expressible without reordering the node array, and matches editor row semantics directly.
3. ~~Percent translate~~ — **already supported**: `translate(-100%, 0px)` parses, tweens, and resolves against the node's own box. The editor's `translateX(-100%)` only needs an adapter rewrite to the two-arg `translate()` form. (Corrected after reading `parseTransform`; the spike's px approximation was unnecessary.)
4. **`shape`/`sticker` node type** — zero occurrences in full templates, but the editor ships shape stickers (rect/circle/triangle/svg) and a sticker panel. A `shape` node (svg path data, fill/stroke) covers the editor's static shapes.
5. **Video nodes contributing audio** (`styles.volume` on clips) — zero occurrences in templates, but the editor exposes clip volume. Already a known roadmap item (slice 14).
6. **`boxShadow` / `border`** — in the editor's type surface for text/image/video; zero occurrences in the sampled templates. Implement with the shape slice; low urgency.
7. **`textDecoration`** — present on every text overlay but **always `"none"`** in real data. Deprioritized; validate-and-ignore is wrong, so add only when a template actually uses it.

### Adapter work (lives in the editor's own repo, not as a public motionforge package)

1. **Font manifest** — map the editor's @fontsource classes to woff2 URLs (the editor already builds a similar font manifest for another feature) and emit scene font assets. The only visible defect in the spike renders.
2. **Animation name coverage** — 11 named templates (`fade`, `slideRight`, `scale`, `bounce`, `flip`, `zoom`, `slideUp?`, `snapRotate`, `glitch`, `swipe`, `float`). Spike implements fade/scale/slideRight/snapRotate. `flip` needs 3D rotateY (won't-support → approximate with scaleX), `glitch` uses unseeded randomness (approximate with a fixed jitter table — determinism contract).
3. **Caption overlays → caption presets** — the editor `CaptionOverlay` carries `Caption[]` word timings + 14 named caption style templates + `highlightStyle`/`entryAnimation`. Map onto `tiktokCaptions`/`karaokeCaptions` generators; the caption-style templates become preset option bundles. Largest single adapter feature; schedule as its own slice (week 2).
4. **`textTransform`** — apply `uppercase/lowercase` to the string at convert time (spike already does).
5. **Static `transform` strings** — merge overlay `styles.transform` with `rotation` and animation keyframes (all `"none"` in sampled data).
6. **Unit/empty-value normalization** — rem/em/empty-string handling as above.

### Won't support (document, fall back to Remotion in the editor)

- **`backdropFilter`** (glassmorphism captions) — no DOM backdrop in canvas rendering. Caption templates using it need a re-styled equivalent.
- **`VISUALIZER` overlays** — audio-reactive rendering; out of scope this cycle.
- **Animated React stickers** (`card-flip`, `boom-effect`, `matrix-effect`…) — these are arbitrary React components. Static/simple ones map to `shape`; the rest wait for the Lottie node or stay Remotion-only.
- **3D transforms** (`flip` animation's `rotateY`) — Canvas2D has no 3D; approximate or fall back.

## Performance notes

- 720p with two decoding video nodes: ~3 ms/frame render+encode (consistent with the 320×180 baseline).
- Remote UHD source fetch dominates wall time (BlobSource fetches whole files). The editor serves presigned S3 URLs of user uploads — same pattern. Streaming sources stay deferred but the full-fetch cost is now measured: acceptable for clips, not for minutes-long 4K footage.

## Recommendation

Proceed with integration. The structural fit is confirmed — every sampled production overlay converts and renders. Ship order: (1) engine `filter` + `zIndex` + `%`-translate, (2) adapter package with font manifest + animation coverage, (3) caption mapping slice, then the editor preview behind a feature flag with Remotion fallback for won't-support overlays.
