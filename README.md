# Zoom transition

React components for an iOS-style zoom transition: a thumbnail on the page zooms
up into a card, its image flying separately from where it sits on the page to
where it sits in the card. Built on React 19 and [Motion](https://motion.dev)
springs. It does not use the View Transitions API: the card opens as an overlay
on the same page (optionally with its own address in the browser history).

## Use

```tsx
import { ZoomProvider, ZoomSource, ZoomHero, useZoom } from "./zoom";
import "./zoom/zoom.css";

export function Work({ projects }) {
  return (
    <ZoomProvider
      renderDestination={(id) => <Project id={id} />}
      getLabel={(id) => projects.find((p) => p.id === id).title} // names the dialog for screen readers
      history={{ mode: "item", url: (id) => `/work/${id}` }}     // optional: real addresses (see below)
    >
      <Grid projects={projects} />
    </ZoomProvider>
  );
}

function Grid({ projects }) {
  const { open } = useZoom();
  return projects.map((p) => (
    <a key={p.id} href={`/work/${p.id}`} onClick={(e) => { e.preventDefault(); open(p.id); }}>
      <ZoomSource id={p.id}>
        <img src={p.thumb} width={1200} height={800} alt="" />
      </ZoomSource>
      {p.title}
    </a>
  ));
}

function Project({ id }) {
  return (
    <article>
      <ZoomHero>                                  {/* the part that flies */}
        <img src={hero(id)} width={1200} height={800} alt="…" />
      </ZoomHero>
      …
    </article>
  );
}
```

- **The hero can sit anywhere in the card.** It can run edge to edge or be inset with a margin, with or without rounded corners. The card lands so the hero covers its thumbnail exactly, and the corner radius blends between the thumbnail's and the hero's.
- **Reserve image space.** Give images `width`/`height` (or CSS `aspect-ratio`). If a hero hasn't loaded and has no size, it can't fly: the card still opens, but without the shared-image effect.
- **Crops can differ.** The thumbnail can be square and the hero wide: if the hero is a single image, its crop changes smoothly during the flight.
- **Plain HTML (e.g. Astro):** mark thumbnails with `data-zoom-source="id"`, put detail markup in `<template data-zoom-destination="id">`, and use `scan` with `renderDestination={(id) => <TemplateDestination id={id} />}`. Template HTML becomes live markup, so it must hold only your own markup, with anything visitors wrote escaped.

## Behaviour

| | |
|---|---|
| Open / close | Click a thumbnail. Close with Esc, the ✕ button, a click on empty space outside the cards, scrolling past the card's top, or a touch drag down. The narrow gap between two cards does nothing, and clicking a neighbour that's peeking in switches to it. Tapping a card while it flies home reopens it. The ✕ fades in once the image has landed. A window resize mid-transition finishes the transition at once. |
| The flight | The image flies from the thumbnail to its spot in the card. Each corner blends from the thumbnail's radius to the one it ends with: the card's own rounded corner, where the image meets it. If the hero is a single image (an `img`/`video` with `object-fit: cover`, or an SVG set to `slice`), the whole picture flies and its crop changes smoothly from the thumbnail's to the hero's. Thumbnail and hero should show the same picture, both centred. |
| Group | Thumbnails in the same `group` become a pager. Use ← → or a touch swipe to move between them. `paging={false}` shows only the opened item. |
| Mouse | A mouse never drags cards. Pressing and dragging selects text. |
| Reduced motion | Instant: no movement, no fade. Follows the device setting live, or `<MotionConfig reducedMotion="always">`. |
| Keyboard / screen readers | Focus moves to ✕ on open and back to the thumbnail on close (without a visible ring if the card was opened by mouse or touch, until the next key press; if your ring is a box-shadow, add it to the `[data-zoom-quiet-focus]` rule in `zoom.css`). The page behind is made `inert` while open. The dialog is named by `getLabel`. Arrow keys inside text fields are left alone. |
| History | With `history`, opening sets the address and Back closes. Give each item a real page at that address, so reloads and shared links work. |

## Scripts

```sh
npm install && npm --prefix review/harness install
npm run typecheck   # strict TypeScript check of src/
npm test            # builds the test app and runs the browser checks (review/harness/tests)
npm run demo        # rebuilds review/demo/zoom-demo.html (fixed + original library, double-click to open)
npm run demo:serve  # serves the demo on your network, to open it on a phone
```

The review of this library, and the fixes made, are in `review/review-report.md`.
