# AGENTS.md

Reference for coding agents working on or with this library. Humans: start with `README.md`.

## What it is

A React 19 component library for shared-element "zoom" transitions. A source (thumbnail) on the page zooms into a card drawn in an overlay on the same page; the card's hero element flies separately between the source's box and its box in the card. Motion 13 springs drive everything. It does not use the View Transitions API and it does not navigate: "pages" are overlay cards. With the `history` prop, the URL changes and Back closes the card.

Source of truth for the API: the JSDoc on `ZoomProviderProps` and the other exported types in `src/zoom/ZoomProvider.tsx`. This file summarises it and records the rules that the code relies on.

## Files

| File | Role |
|---|---|
| `src/zoom/index.ts` | Public exports. Nothing else is public. |
| `src/zoom/ZoomProvider.tsx` | All state and transitions: open, close, reopen (turn-around), paging, history, focus, inert, clipping the card around the flying hero, the close-button copy. About 2,300 lines. |
| `src/zoom/flight.ts` | The flying copy of a hero (`createFlight`), its geometry (cover-fit plus crop, per-corner radii, whole-picture `fill` for single-image heroes), and snapshots and style freezing. |
| `src/zoom/gestures.ts` | Touch drag (dismiss and paging), wheel and trackpad (dismiss and paging), and click routing (close, page, gap, reopen). The mouse never drags. |
| `src/zoom/springs.ts` | `springTo` (a Motion spring with a safety timer) and `settle` (stop a spring and jump to a value). Also the SwiftUI-style spring physics and the default timings. |
| `src/zoom/ZoomSource.tsx`, `ZoomHero.tsx`, `TemplateDestination.tsx` | Small components; see below. |
| `src/zoom/zoom.base.css` | Required structural CSS. |
| `src/zoom/zoom.theme.css` | Optional default look. Every rule is wrapped in `:where()`, so it has zero specificity. |
| `src/zoom/zoom.css` | Imports both of the above. |
| `review/harness/` | Test app, Playwright tests, probes, the demo builder and a LAN server. Not part of the library. |
| `review/review-report.md` | History of the first review and its rounds of fixes. It is not a spec; this file and the JSDoc are. |
| `review/independent-review/` | The later independent review: its report (with the fixes made since), the current double-click demo (`zoom-demo.html`, built by `build.mjs`) and its probes. |

## Public API

- **`<ZoomProvider renderDestination={(id) => node} …>`** renders the overlay into `document.body` (or into `container`). See below for its props.
- **`<ZoomSource id group? as?>`** wraps what zooms. Its box is measured, hidden and flown from. It doesn't handle clicks: call `useZoom().open(id)` from a surrounding `<a>` or `<button>`, which is also where focus returns on close. Sources with the same `group` form one pager, ordered as they appear in the DOM. The same id may appear more than once (a featured tile and a list): the card opens from, and lands back on, the copy that was clicked or focused.
- **`<ZoomHero live?>`** marks the flying element inside the destination content. With `live` (the default), its React children also render inside the flying copy, which then sits outside the card, so style it with its own classes rather than with selectors that depend on its position in the card.
- **`<TemplateDestination id>`** renders `<template data-zoom-destination="id">` as live HTML, for use with `scan`. Inline handlers in the template run, so templates must contain only trusted markup.
- **Hooks:**
  - `useZoom()` returns `{ open, close, isOpen }`.
  - `useZoomItem()`, used inside a destination, returns `{ id, index, isActive, close }`.
  - `useZoomProgress()` returns motion values: `progress` (0 = on the source, 1 = open; it overshoots) and `focus` (1 for the visible page).
  - `useZoomEvent(handler)` receives `opening | opened | closing | closed | activated | deactivated`.
  - `useZoomValue(name, initial)` returns a motion value shared between a card and its flying copy.

### `ZoomProvider` props (defaults in brackets)

`renderDestination` (required) · `getLabel` [the id], which names the cards and the dialog (always pass real titles) · `closeLabel` ["Close"] · `closeButton` [true; false hides it; a function renders your own, and any element with `data-zoom-close` inside it closes the card and takes focus on open (without one, the card itself takes focus)] · `closeButtonTiming` ["flight": a copy of the close button above the flying image fades with the flight; "after": the button fades in over 100 ms after landing] · `history` [false; `{ mode: "session" | "item", url? }`, where `url` defaults to `#id`; with the default, a page loaded at `#id` opens that card instantly] · `paging` [true] · `orientation` ["horizontal"] · `layout` ["pager"; "stream" is one scrolling column] · `geometry` [side 18, gap 8, top 24, bottom 14, maxCardWidth 720; or a function of the viewport size] · `dim` [0.35] · `timing` [`defaultTiming`; `page` is 0.25 s, no bounce] · `timeScale` [1] · `landing` [the hero covers the source; passing it switches to widthRatio/topOffset] · `dismiss` [drag and wheel edges: top only] · `hideGroupWhileOpen` [true: the rest of the group fades out as the card opens; false: only the visible source is hidden] · `groupOpacity` · `flyHome` ["group"] · `scan` [false; true scans `[data-zoom-source]`] · `container` [body] · `background` [all other children of `<body>`, made inert] · `debug`.

## Markup contract

**You set:**
- `data-zoom-source="id"` and `data-zoom-group` (with `scan`)
- `<template data-zoom-destination="id">`
- `data-zoom-hero` (inside templates)
- `data-zoom-close` (inside a custom close button)

**The library sets:**

| Attribute | Where | Meaning |
|---|---|---|
| `data-zoom-hidden` | sources | hidden; a base CSS rule applies `visibility: hidden !important` |
| `data-zoom-dimmed` | sources | `groupOpacity` |
| `data-zoom-quiet-focus` | the element focus returns to | no focus ring until the next keydown |
| `data-open`, `data-phase` (`idle` / `opening` / `open` / `closing`) | `.zoom-root` | the overlay's state |
| `data-close-sync` | `.zoom-root` | closeButtonTiming is "flight" |
| `inert` | the background and inactive cards | not reachable while a card is open |
| inline `clip-path` | `.zoom-card` | while its hero flies |

**Classes:** `.zoom-root`, `.zoom-dim`, `.zoom-zoomer`, `.zoom-track` / `.zoom-stream`, `.zoom-card` (an `article`), `.zoom-card-scroll`, `.zoom-card-content`, `.zoom-close-bar`, `.zoom-close`, `.zoom-flight`, `.zoom-clone`, `.zoom-live`, `.zoom-close-copy`. The card markup is fixed.

## Content requirements (user-visible failures if broken)

- **Reserve the hero's size** (img `width`/`height` or CSS `aspect-ratio`). A hero measuring 0 can't fly (`canFly`): the card opens without the shared image.
- **Smooth crop change** needs a single-image hero: exactly one `img`/`video` with `object-fit: cover`, or an `svg` with `preserveAspectRatio` "slice", and no text in the hero. The source should show the same picture, centred. Any other hero flies as a cropped copy of the hero's own box, so differing crops shift at take-off.
- **A hero image still downloading** (the usual case on a first open: the detail photo is a bigger file than the thumbnail) flies as the source's picture, when the source is a single loaded `img` or an inline `svg`, and switches to the hero's own when it arrives. Any other source: the box flies empty until then.
- **Give every item a real `getLabel`** title.
- **With `history` and your own `url`, serve a real page at each address.** Only the default `#id` addresses open a card on page load.

## Invariants when changing the code

- **Mutable state lives in `S`** (a ref) and in `items` (per-id `Item`). React state (`session`, `index`, `layout`) only drives rendering. Callbacks are created once and read `latest.current` for props.
- **Phases** go `idle → opening → open → closing → idle`. A close can be turned around (`reopen`) and so can an open (`close` while opening). Every transition bumps `S.gen`, and a completion must check `gen === S.gen` before acting.
- **Modes.** `S.mode` is "zoom" while opening (one shared transform `zx`/`zy`/`zs` on `.zoom-zoomer`) and "cards" for closing and turn-arounds (each card's `cv` values; `bake()` folds the shared transform into per-card values). The on-screen card transform is always `X = zx + zs*(slot.x + cv.x)` and `scale = zs*cv.s`.
- **Read all layout first, then write.** In `transitionCards` everything is measured into `measured` before `bake()`. Never read layout per frame: per-frame work (the flight `write`, the card clip in `clipCard`, the close copy in `moveCloseCopy`) is computed from motion values in Motion's `frame.render`.
- **Every animation goes through `springTo`**, never through Motion's `animate` directly. Its safety timer finishes a spring that overruns, and it converts velocities (measured in real time) to the spring's own clock under `timeScale`. To finish something instantly use `settle(value, to)`; a plain `jump` lets a pending safety timer override it later.
- **Cards render lazily (pager layouts).** Opening renders only the visible card and its neighbours (`S.ready`); `fillCards` adds the rest a few at a time while idle after landing, and `setIndex` keeps the new neighbours rendered. A card that isn't rendered has no element in `cardEls`: closing fades it instead of flying it. So does a card whose source is off screen.
- **Focus moves only through `focusCard` and `returnFocus`, guarded by `mayMoveFocus`:** never away from something the visitor chose since the last transition, and never into a frame that doesn't have focus.
- **Covering headers.** `measureBands` hit-tests (skipping the overlay) what covers each on-screen source at open and at close; `coverBand` keeps the flight and the card clip below it near the source.
- **Reduced motion** (`S.reduced`, read live from `matchMedia` or `MotionConfig reducedMotion="always"`) is instant: no springs, no fades. Keep any new motion out of the reduced paths.
- **Cleanup.** `endFlight` removes the copy, the card clip and (when idle) the clip loop. `closeDone` and the unmount effect restore the sources, scrolling, `inert` and focus. Add any new resources to these.
- **A resize during a transition finishes it immediately** (`finishNow`). Don't re-aim springs at a layout that is still changing.
- **CSS:** structural rules go in `zoom.base.css`; visual defaults go in `zoom.theme.css`, inside `:where()`. A test asserts that `zoom.css` equals base plus theme.
- **Style:** comments explain intent in plain prose; match the existing density. `npm run typecheck` uses `noUnusedLocals`.

## Build and test

```sh
npm install && npm --prefix review/harness install   # the test bundles always use review/harness's React
npx --prefix review/harness playwright install chromium   # or set PW_CHROMIUM=/path/to/chrome
npm run typecheck
npm test          # builds review/harness/dist, then runs review/harness/tests/review.spec.ts
node review/independent-review/build.mjs   # rebuilds the current demo, review/independent-review/zoom-demo.html
npm run demo      # rebuilds the first review's demo, review/demo/zoom-demo.html (needs full git history; its notes describe that round)
```

- **Writing a test:** the test app (`review/harness/app/main.tsx`) renders a scenario chosen by `window.ZOOM_DEMO`: `{ scenario, props?, timeScale?, heroLive?, noTheme?, lateUrl?, closeTiming? }`, passed as JSON in `dist/test.html?…`.
- **Measuring:** the helpers in `review/harness/probes/lib.mjs` (`record`, `cloneVisible`, `clean`, `src`, `card`) run in the page and measure the transition frame by frame.
- **What to assert:** geometry to ±1 px, and `clean()` returning to idle with nothing left over.
- **Known limitations:** one test is marked `test.fail()` on purpose: template inline handlers run.
- `tests/fixes.spec.ts` covers the fixes made after the independent review; each of its tests fails against the library as it was before them.

## Known limitations

- **Not tested beyond headless Chromium:** Safari, Firefox and real phones.
- **Deep links** work for the default `#id` addresses only (the card opens instantly on load). With your own `url`, use real per-item pages.
- **Sticky headers:** the flying image and its card stay below a header covering the source, but the faint neighbouring cards can pass over it for a moment at take-off.
- **Opening start cost:** about 130 to 190 ms of main-thread work with the CPU slowed 4×, roughly the same for any group size. The rest of the group's cards (and their images) load after landing.
- **Off-screen sources** are scrolled into view instantly before a close.
- **Stateful heroes** (video, canvas, iframes) restart or go blank in a live flight; use `live={false}`.
- **Clip-path is updated every frame** on the flying image and its card (a repaint per frame); untested on real phones.
