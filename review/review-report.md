# Zoom transition library: review report

**Reviewed:** the zip as received (`src/zoom/*`, `package.json`), unmodified. It is committed to this repo as-is.
**How I tested it:** I read every line, ran a strict type check, and built a test app around the unmodified library. I then drove that app in a headless Chromium browser: 30+ scripted scenarios, frame-by-frame position measurements, Chrome's performance counters with the CPU slowed 4×, and screenshots. Chromium was the only browser available here, so nothing below has been tested in Safari or Firefox.
**Labels:** **[Confirmed]** = I reproduced it in the browser. **[Code]** = from reading the code, not reproduced. **[Uncertain]** = my best judgement, not verified.

---

## 0. Round 2: fixes made, and what's left

After the first review, you asked me to:
- make reduced motion instant instead of a fade
- support images that sit inset inside the opened card
- stop the mouse from dragging cards, so text can be selected
- fix the biggest issues

All changes are in `src/zoom/`. The library as received is still the repo's first commit. The demo has a **Fixed / Original** switch, so you can compare the two. With the fixed library, 20 of the 22 browser tests pass. The other 2 fail as expected: they check the deep-link and template limitations below.

| # | Issue | Status | What changed (file) |
|---|---|---|---|
| C-1 | Unloaded photo freezes the page | **Fixed** | A hero with no size yet doesn't fly: the card zooms on its own, and the photo appears in it when it arrives (`flight.ts` `canFly`, `ZoomProvider.tsx` open/close). Separately, no spring can hang any more: a spring with an invalid target lands at once, and a safety timer finishes any spring that runs far past its expected time (`springs.ts` `springTo`). |
| I-1 | Focus escapes behind the card | **Fixed** | As a full-window overlay, the rest of the page is made `inert` automatically while open, and given back on close (`setBackgroundInert`). |
| I-2 | Arrow keys hijacked in text fields | **Fixed** | Keys typed into inputs, textareas, selects and editable text are left alone, as are shortcuts with modifier keys. Content can stop Esc by handling it first. Esc inside a field still closes the card, as native dialogs do. |
| I-3 | Screen readers not told anything opened | **Fixed** | The dialog is named after the visible item (`aria-label` from `getLabel`). |
| I-4 | Resize during opening leaves the card the wrong size | **Fixed** | The layout is re-measured when the opening finishes (`openDone`). |
| I-5 | Corner pop at take-off | **Fixed** (round 3: per corner, and the content shift too) | Corners blend from the source's radii to the hero's, read from the element or its first child (`flight.ts`). Round 3 added per-corner handling and the thumbnail dissolve; see below. |
| I-6 | History failure throws visitors off the site | **Fixed** | History writes are guarded, and only entries the browser accepted are counted. |
| I-7 | Text can't be selected | **Fixed** | Per your suggestion: **a mouse no longer drags cards**, and text selects normally. Touch keeps every gesture (tested). Mouse and trackpad users page with the wheel or arrow keys, and close by scrolling past the top, Esc, ✕ or a click outside. A text selection dragged past the card doesn't count as a click outside. |
| I-8 | No tests, docs, working scripts | **Fixed** | `README.md`, a root `tsconfig.json`, working `typecheck` / `test` / `demo` scripts, and 22 browser tests. |
| — | **Reduced motion** (your change) | **Changed** | Now **instant**: no movement and no fade, on open, close and paging. It also follows the device setting live, without a reload (this was M-3). An app-wide `<MotionConfig reducedMotion="always">` turns it on too. |
| — | **Inset images** (your change) | **New** | When a card has a hero, the card now lands so its *hero* sits exactly on the thumbnail. A hero inset with a margin and its own radius grows out of the thumbnail with the card around it. An edge-to-edge hero behaves exactly as before. Measured at 0 px difference on desktop and phone. |
| M-4 | Vanished source → card flies to the corner | **Fixed** | A source that's gone or 0×0 counts as missing, so the card fades instead. |
| M-1, M-5, M-6, M-7, M-8, M-9 | Sticky-header pop, row jump, startup freeze on slow phones, ✕ pop-in, duplicate ids, late `scan` sources | Not fixed | Minor, or not relevant to your layout (no sticky header, no sideways rows). M-6 should be checked on a real phone. |
| M-2 | Deep links | Not fixed in the library | Solved by the framework choice below: every project gets a real page. |
| S-1 | Template HTML runs inline handlers | Documented | Correction to my first report: cloning the template's nodes would *not* stop this (inline handlers run whenever the markup is inserted). The component now documents that templates must hold only your own, escaped markup. |

### Round 3: from your demo results (Chrome 154, macOS)

| Your note | What changed |
|---|---|
| Esc after a mouse open shows a focus ring | **Fixed.** Focus still returns to the thumbnail, which keyboard and screen-reader users need. If the card was opened with a mouse or finger, no ring shows until the next key press (`data-zoom-quiet-focus`, plus `focusVisible: false` where browsers support it). Opened with the keyboard, the ring shows as before. If your site's focus ring is a `box-shadow` rather than an outline, add it to the `[data-zoom-quiet-focus]:focus-visible` rule in `zoom.css`. |
| Click empty overlay space to close | **Fixed.** Any click outside the cards closes. Before, the space beside the card paged instead, even with no neighbour there. Clicking a neighbour that's peeking in still switches to it. |
| ✕ covered by the image in flight, then pops over it | **Fixed.** The button is hidden while a hero flies and fades in (180 ms) once it lands. With reduced motion, it's simply there. |
| Corners pop in the card grid (sharp, then rounded) | **Fixed.** You were right: round 2 only blended to the hero's *own* radius. An edge-to-edge hero is rounded by the *card's* corners. Corners are now handled one by one: where the hero meets a corner of the card, it blends to the card's radius (28 px at the top in the demo), elsewhere to its own (square). The same happens in reverse on close. |
| Images jump on close when crops differ (scenarios 2 and 6) | **Fixed** (replaced in round 4 by a smooth crop change, below). The flight now carries a copy of the thumbnail on top of the hero. The copy dissolves into the hero over the first half of the zoom, and back again over the last half of a close. Different crops, or even different images, no longer jump. With matching crops, as in your layout, the dissolve is invisible. Trade-off: with very different crops, both pictures show faintly at once for a moment mid-dissolve. The dissolve length is one constant (`DISSOLVE` in `flight.ts`, currently half the zoom). Copying the thumbnail adds about 8 ms at the start of each open on a desktop (about 30 ms with the CPU slowed 4×). |
| Resize during opening snaps when it finishes ("expected?") | It was expected with the round 2 fix. It's now **re-aimed immediately**: the card adjusts at the moment of the resize, then settles into the new size with no snap at the end. |
| Stages don't load on mobile | Opening a downloaded HTML file on a phone usually shows it without running its scripts, so the stages can't load. **Fix:** run `npm run demo:serve` and open the printed address on your phone (same Wi-Fi). Checked on an emulated phone; not on a real iPhone **[Uncertain]**. |

All 27 browser tests pass: 25 behaviour checks, plus the 2 known limitations, which fail as expected.

### Round 4: second results round

All changes are in the library (`src/zoom/`), which your site will use. The demo only bundles it.

| Your note | What changed |
|---|---|
| Fade the ✕ faster | 180 ms → **100 ms**. |
| Don't dismiss on the small gap between projects | **Clicking the gap between two cards now does nothing.** Clicking a neighbour still switches to it, and clicking other empty space (above or below, or past the first or last card) still closes. It works in every layout: side by side, vertical (`orientation="vertical"`, gaps above and below) and a single scrolling column (`layout="stream"`). |
| Resize mid-transition lurches while the spring catches up | **A resize during a transition now finishes it at once,** at the new size: an opening card is simply open, a closing card simply closed. Nothing chases a layout that's still changing. A resize while open re-fits as before. |
| No dissolve; shift smoothly between aspect ratios | **The dissolve is gone.** When the hero is just one image (an `<img>` or `<video>` with `object-fit: cover`, or an SVG set to `slice`), the flight carries the *whole* picture and crops it. The crop moves smoothly from what the thumbnail shows to what the detail page shows. The first frame matches the thumbnail (measured pixel difference 0.5 of 255; the original measured 9.3), with no double image. Heroes with anything else in them (text over the image, several images) fly as before. One assumption: the thumbnail and hero crop the same picture, both centred. |

All 31 browser tests pass: 29 behaviour checks, plus the 2 known limitations, which fail as expected.

### Recommended setup for a portfolio on Cloudflare: Astro

**Use [Astro](https://astro.build) with its React integration**, and build it as a static site:
- **It's built for content sites like a portfolio.** Pages are plain HTML by default, with no JavaScript unless you ask for it. You add React only where it's needed (an Astro "island"): here, the zoom on the index page.
- **Each project gets a real page, such as `/work/slug`.** Pass `history={{ mode: "item", url: (id) => "/work/" + id }}`. Opening a project then updates the address, Back closes it, and a shared link or reload opens that project's own page directly. That's the deep-link problem (M-2) solved without any library code.
- **Its image component (`astro:assets`) sets each image's width and height,** so image space is always reserved. That prevents layout shift and the late-photo problem by design.
- **The library already supports it.** The `scan` + `TemplateDestination` path was written for Astro: plain-HTML thumbnails, with the detail content written in Astro. Or render the index as a React island with `ZoomSource`/`ZoomHero`.
- **Cloudflare supports Astro directly.** A static build needs no adapter: the build command is `astro build`, and the output folder is `dist`.

**Two cautions:**
- Don't also turn on Astro's own page-transition feature (`<ClientRouter />`) on the index, or two transition systems will compete.
- **[Uncertain]** Cloudflare has been steering new projects from Pages towards Workers' static-asset hosting. Both serve a static Astro build the same way, but check which one Cloudflare suggests when you create the project.

Alternatives I'd rank lower for this: Next.js (heavier; React everywhere; needs an extra adapter on Cloudflare) and a plain Vite + React single-page app (no real per-project pages without extra work).

---

## 1. Verdict (library as received)

**Usable with fixes; not as-is.** The core of the library is well built:
- Pictures leave from and land on exactly the right pixels: on scrolled pages, on phone widths and under sticky headers.
- It survives rapid clicks, Esc, the Back button mid-animation and random input without leaving anything behind.
- It animates only `transform` and `opacity` (plus `clip-path`), and holds 60 fps on a desktop.
- It has a proper reduced-motion fallback.

You should not ship it as-is, for four reasons:
- **One critical bug.** If a detail page's main photo hasn't downloaded yet, the opening freezes and the page stays broken until reload. That is the normal case on a first visit, unless the photo's space is reserved in CSS.
- **Accessibility gaps.** Keyboard focus escapes behind the open card, arrow keys are hijacked inside text fields, and screen readers aren't told anything opened.
- **Visible "pops" at take-off.** Rounded corners turn square and the picture inside shifts.
- **Nothing an engineer needs to maintain it ships with it.** There are no tests and no README, the build and test scripts point to files that aren't in the zip, and comments refer to someone else's site.

All of these have targeted fixes; a rewrite isn't needed. Budget roughly **3–5 days of a front-end engineer's time** to fix the Critical and Important items and add tests **[Uncertain: estimate]**. Whoever adopts it should also be prepared to own about 3,400 lines of dense, specialised code, 2,000 of them in one file.

---

## 2. Orientation (plain language)

### What it is built with

| Piece | What it is | Notes |
|---|---|---|
| **React 19** | A popular framework for building web pages out of reusable "components" (self-contained building blocks). | Required. The library is a set of React components. |
| **Motion 13** (formerly Framer Motion) | An animation library. This one uses its *springs*: animations that move like a physical spring (natural speed-up and settle) rather than following a fixed timeline. | The only runtime dependency besides React. The timings mimic Apple's SwiftUI springs (`springs.ts`). |
| **TypeScript** | JavaScript with type checking. | Passes a strict check apart from two unused variables. |
| **One CSS file** (`zoom.css`) | Default styles. | Themeable through `--zoom-*` CSS variables. |

**It does *not* use the View Transitions API** (the browser's built-in feature for animating between pages), or any other cutting-edge browser feature. That has two consequences:
1. **It doesn't transition between real pages.** The "next page" is drawn as a layer (an *overlay*) on top of the current page, and the page underneath never changes. With the optional `history` setting, the address bar *changes* to look like a new page, but it's still the same page.
2. Browser support depends on ordinary, widely supported features, not on View Transitions (see §4).

All the npm package versions it lists (Motion 13.5, React 19.3, etc.) exist. Nothing is invented.

### How it works, step by step
1. You mark the things on your page that can zoom: a card thumbnail, say. These are **sources**.
2. You describe what each source opens into: the **destination** (detail page). Inside it, you mark one element as the **hero**, usually the big picture at the top.
3. On click, the library builds the destination in an overlay (a layer covering the whole window), at full size but invisible. It measures where the hero will end up, then shrinks the whole overlay down onto the source.
4. It animates two things at once. The whole card springs from the thumbnail's position up to full screen. Meanwhile, a **copy of the hero** flies separately along its own path, from the thumbnail to its final spot. When the copy lands, the real hero takes over and the copy is deleted.
5. Closing runs the same thing in reverse. Every card in the group flies back to its own thumbnail.

Extras: swipe or use ← → to move between items in a group, with neighbours peeking in at the sides. Drag the card down, or scroll past its top, to close it. Optional browser history (Back closes). Vertical and "stream" layouts. A `timeScale` setting for slow motion. A cross-fade instead of motion when the device asks for reduced motion.

### How a developer uses it
```tsx
<ZoomProvider renderDestination={(id) => <ArticlePage id={id} />}>
  {articles.map((a) => (
    <button onClick={() => open(a.id)}>          {/* open comes from useZoom() */}
      <ZoomSource id={a.id}><img src={a.thumb} /></ZoomSource>
    </button>
  ))}
</ZoomProvider>

function ArticlePage({ id }) {
  return <><ZoomHero><img src={hero(id)} /></ZoomHero> …article text…</>;
}
```
There is a second route for sites not written in React, such as static Astro sites. You add `data-zoom-source="id"` attributes to plain HTML, put each detail page's HTML inside a `<template data-zoom-destination="id">` element, and use `scan` with `<TemplateDestination>`.

---

## 3. What I tested, and the result

| Scenario | Result |
|---|---|
| Start and end position of the flying picture: top of page, scrolled page, 390 px phone, sticky header, static hero | **Exact** (0–0.4 px difference) |
| Card grid open → page between items → close | Works |
| Window resized while a card is open, then closed | Works; lands on the moved thumbnail |
| Window resized *while a card is opening* | **Bug** (I-4) |
| Detail photo that hasn't downloaded yet | **Critical bug** (C-1) |
| Reduced motion | Cross-fade only; nothing moves; paging is instant ✓ |
| Double-click, 8 fast clicks, Esc halfway, Back halfway, tap while flying home, fast arrow keys, 25 random actions | All end clean ✓ |
| ~45 transitions: leftover copies, hidden items, locked scrolling, event listeners | None ✓ (listener counts identical before and after) |
| Keyboard: focus on open and close | Correct ✓ |
| Keyboard: Tab while open, arrows in a text field | **Bugs** (I-1, I-2) |
| Performance (desktop) | 60 fps; the layout is recalculated only ~8 times per whole transition, not once per frame ✓ |
| Performance (CPU slowed 4×, a stand-in for a mid-range phone) | Smooth once moving; a 100–190 ms freeze at the start (M-6) |

---

## 4. Issues

### Critical

#### C-1. A detail photo that hasn't downloaded yet freezes the page **[Confirmed]**
- **What a user experiences:** they click a card on their first visit, before the big photo has downloaded. The zoom starts, then gets stuck:
  - A stray copy of the photo is left floating over the top-left of the screen, and the photo's spot in the card stays blank.
  - Dragging to close does nothing. Esc starts closing but never finishes.
  - After that, the page can't scroll, the card they clicked stays missing from the grid, and clicking another card opens *all* of them in a broken state.
  - **Only a reload recovers.**
- **When it happens:** whenever the hero is an image without reserved space (no `width`/`height` attributes and no CSS `aspect-ratio`) that isn't already cached. That is very common on a first visit. With space reserved, it works (demo scenario 6, cards 2/4/6).
- **Why:** the library measures the hero before the image has a size, so its height is 0. It then divides by that 0 (`flight.ts:96`, `Math.max(r.w / W0, r.h / H0)`), which gives "infinity", and the animation can never reach its end point. Nothing has a time limit, so the "opening finished" step (`ZoomProvider.tsx:1253`) never runs.
- **Fix:**
  1. In `createFlight`/`fit`, treat a zero-width or zero-height hero as "no hero": just zoom the card, or fade the hero in.
  2. Before measuring, wait briefly for images inside the hero to load (`img.decode()`, with a ~150 ms cap).
  3. Add a safety net: if a transition hasn't finished within ~2 seconds, jump to the end state and clean up.
  4. In the documentation, tell content authors to always reserve image space. This is good practice anyway, because it prevents layout shift.
- Evidence: `review/evidence/late-real-stuck.png`, `late-real-after-escape.png`, `late-100.png` (a giant blown-up piece of the image's alt text flies across the screen in the timer-based version). Test: `CRITICAL: a hero image…`.

### Important

#### I-1. Keyboard focus escapes to the hidden page behind the card **[Confirmed]**
- **What a user experiences:** a keyboard user opens a card. After three Tab presses, focus lands on the header links of the page *behind* the overlay, which they can't see. Screen-reader users can also wander into the page behind.
- **Where:** the overlay claims to be a modal dialog (`role="dialog" aria-modal="true"`, `ZoomProvider.tsx:1942`). However, it only blocks the page behind if the developer passes the optional `background` prop (`setBackgroundInert`, `:1126`), and nothing says this is essential.
- **Fix:** while open, automatically make everything except the overlay `inert` (make every child of `<body>` other than the overlay inert), or trap focus inside the card. Then drop the optional prop.

#### I-2. Arrow keys and Esc are hijacked inside text fields **[Confirmed]**
- **What a user experiences:** in a form inside a detail page, such as a comment box, pressing ← or → switches to another story instead of moving the cursor. Whatever they typed goes with the card they left, and focus jumps to the ✕ button. Esc in the field closes the whole card.
- **Where:** the window-wide key handler, `ZoomProvider.tsx:1768–1784`.
- **Fix:** ignore keys when focus is in an `input`, `textarea`, `select` or `[contenteditable]`, or when another handler has already used the key (`e.defaultPrevented`).

#### I-3. Screen readers aren't told that anything opened **[Confirmed]**
- **What a user experiences:** with VoiceOver or NVDA, the user hears "Close, button" and little else. The dialog has no name, and the live announcement only fires when paging between items (`:1345`), never on open.
- **Fix:** label the dialog with the visible card's name (`aria-labelledby`, pointing at its title), and announce "Opened: [title]" on open. Also: the default `getLabel` is just the item's id. Require or derive a real title.

#### I-4. Resizing or rotating during the opening animation leaves the card the wrong size **[Confirmed]**
- **What a user experiences:** they rotate a phone, or resize the window, in the half second while a card is zooming open. The card stays at the old size and hangs off the screen (in the test, 960 px wide in a 600 px window) until they resize again.
- **Where:** the resize watcher ignores every state except "open" (`ZoomProvider.tsx:1840–1841`).
- **Fix:** remember that a resize happened, and re-measure when the opening finishes (in `openDone`).

#### I-5. Rounded corners and picture contents "pop" at take-off and landing **[Confirmed]**
- **What a user experiences:**
  - On the very first frame, a thumbnail with rounded corners (14 px in the demo) turns square, and turns rounded again only when it lands back.
  - The picture inside also visibly shifts or zooms on the first frame whenever the thumbnail and the detail page crop the image differently (for example, a 4:3 thumbnail and a 16:10 hero). The flying copy is always the *detail page's* picture, so it never matches the thumbnail exactly.
  - Slow motion in the demo makes both easy to see.
- **Where:** the corner radius is read only from the hero (`flight.ts:213`). Nothing reads the source's styling.
- **Fix:** read the source's corner radius and animate between it and the hero's. To avoid the content jump, briefly cross-fade a copy of the source thumbnail into the flying hero during the first ~20% of the flight. Until then, as a design rule, use the same crop for thumbnails and heroes.

#### I-6. With browser history on, closing can throw the visitor off your site **[Confirmed]**
- **What a user experiences:** if the browser refuses to save a history entry, the library still counts it as saved. Closing the card then performs a "Back", which leaves your site for whatever page they were on before.
- **When it happens:** pages embedded in sandboxed or `srcdoc` frames (CMS previews, Storybook-style tools), or a `history.url` setting that returns an address on another domain. In my test, closing a card navigated the whole tab to the previous website.
- **Where:** `S.histDepth += 1` runs *before* `pushState`, which isn't wrapped in `try/catch` (`ZoomProvider.tsx:724–725, 736–737`). Closing then calls `history.go(-n)` (`:754`).
- **Fix:** wrap `pushState` and `replaceState` in `try/catch`, and count the entry only if it succeeded.

#### I-7. Text in an open card can't be selected or copied **[Confirmed]**
- **What a user experiences:** they can't highlight an address, a quote or a code in a detail page to copy it.
- **Where:** `zoom.css:10–11` sets `user-select: none` on the whole overlay.
- **Fix:** apply it only while a drag is in progress (`.zoom-dragging`), not all the time.

#### I-8. It arrives without tests, documentation or working scripts **[Confirmed]**
- **Missing pieces:**
  - `package.json`'s scripts reference files that aren't in the zip: `build.py`, `test/scan.tsx`, Playwright tests and `standalone/portfolio/build.py`.
  - There is no `tsconfig.json`, so `npm run typecheck` fails immediately, and `npm test` has no tests to run.
  - There is no README. The options are documented only in code comments.
- **Leftovers from someone else's site:** comments mention "the books", "projects", "Astro" and "a dropped frame each time a book took off".
- **Why it matters:** nobody can safely change this code without tests, and spring and gesture code is exactly where changes break things quietly.
- **Fix:** start from the test suite in `review/harness/tests/` (18 checks). Add a README with a minimal example and the essential props.

### Minor

| # | What a user experiences | Where | Suggested fix | Label |
|---|---|---|---|---|
| M-1 | **Sticky header:** if a card is partly under a sticky header, the hidden part jumps out on top of the header at take-off. On close, the card lands on top of the header, then snaps underneath. | The overlay sits above everything (`zoom.css:13`, `z-index: 1000`), and the flight isn't clipped to what's visible. | Clip the flight to the visible part of the source, or treat a mostly hidden source as off-screen and scroll it into view first (respecting `scroll-padding-top`). | Confirmed |
| M-2 | **Deep links:** a shared link or reload with `#item` (the default history address) opens the plain grid, with nothing zoomed. The address keeps a stale `#item`. | Nothing reads the address on load. The comment at `:198–199` expects real server pages at each address. | Either read `location`/`history.state` on load and open that item instantly (no animation), or document clearly that every item needs a real page at its URL. | Confirmed |
| M-3 | **Reduced motion:** switching it on while the page is open has no effect until reload. Apps with their own in-app "reduce motion" switch (Motion's `MotionConfig`) are ignored. | Motion's `useReducedMotion` hook reads the setting once (`:541`). Its own source marks this as a TODO. | Listen to `matchMedia('(prefers-reduced-motion: reduce)')` changes directly. Use `useReducedMotionConfig` to honour `MotionConfig`. | Confirmed (live change). MotionConfig: from Motion's source, not tested. |
| M-4 | **Responsive layout:** if the thumbnail has disappeared when you close (for example, a layout change hid it after rotating), the card flies into the top-left corner of the screen instead of fading out. | The "nothing to return to, just fade" branch (`:1496`) only catches a missing element, not a 0×0 hidden one. | Treat a zero-size or detached source as missing. | Confirmed |
| M-5 | **Off-screen thumbnail:** closing onto a thumbnail scrolled out of view in a sideways row makes the row jump instantly to show it, before the card flies home. | `revealSource`, `:1630` (`behavior: "instant"`). | Acceptable trade-off. Optionally scroll smoothly, then fly. | Confirmed |
| M-6 | **Startup freeze on slower devices:** with the CPU slowed 4×, every open starts with a 100–190 ms freeze, or 280–430 ms with non-live heroes (`ZoomHero live={false}`). The first frames are skipped, so the zoom starts "late and already moving". Part of the cost is building *every* card in the group up front (153 ms for 9 cards vs 101 ms for 1). On a desktop the freeze is under ~50 ms and invisible. | Card mounting for the whole group (`:1960`). Copying every computed style property into the snapshot (`flight.ts:220`). | Build only the visible card and its two neighbours. Prepare static snapshots ahead of time. **Test on a real mid-range Android phone.** | Uncertain (CPU-slowed emulation, not a real phone) |
| M-7 | **Close button pops in:** the ✕ button appears only at the very end, because the flying picture covers it. | The flight layer is above the cards. | Fade the ✕ in during the last part of the flight, or put it above the flight layer. | Confirmed |
| M-8 | **Duplicate ids during flight:** the flying copy duplicates the hero's `id` attributes. That can break SVG gradients or label links inside the hero mid-flight, and makes the page invalid during the flight. Videos and iframes in a hero would be duplicated too (they might reload or play twice). | `cloneNode(true)`, `flight.ts:57, 63`. | Strip `id`s from the copy and swap media for posters. | Code |
| M-9 | **Late-added plain-HTML sources ignored:** with `scan`, items added to the page later (infinite scroll, client filtering) are never picked up. | The scan runs once, at start-up (`:1878–1900`). | Re-scan on change (a `MutationObserver`), or offer a `rescan()` function. | Code |
| M-10 | **Code tidiness** (no user impact). | Two unused variables (`:1382`, `:1428`). An orphaned duplicate doc comment (`:956`). A comment that contradicts the defaults: `:807` says "slightly narrower… just above", but the defaults are exactly as wide and top-aligned. A CSS class that is set but never styled (`zoom-streaming`, `:1939`). Two internal lists that grow with every distinct item ever opened and are never trimmed (`items`, `presence`). | Clean up while adding tests. | Code |

### Security

- **S-1 (Minor, conditional). `TemplateDestination` turns template HTML into live HTML [Confirmed].**
  - `<template>` content is normally inert. But when a card opens, this component inserts it with `dangerouslySetInnerHTML` (`TemplateDestination.tsx:14`), and inline event handlers inside it then run. In my test, an `<img onerror=…>` in a template executed once on open.
  - If templates only ever contain your own markup, this is fine. It becomes a cross-site-scripting hole only if user-written content (comments, reviews) is placed into templates *unescaped*, on the assumption that templates are safe.
  - **Fix:** document that template content must be trusted or escaped. (Round 2 correction: cloning the template's nodes instead of using `innerHTML` would not help, because inline handlers run either way.)
  - Nothing else uses `innerHTML` or similar. The selector lookup correctly escapes ids (`CSS.escape`).

---

## 5. Browser support
- **What it needs:** React 19, ResizeObserver, the `inert` attribute, CSS `clip-path`, `container-type`, `overflow: clip` and `scrollbar-gutter`. All of these are in current Chrome, Edge, Firefox and Safari. Roughly Safari 16+ and Firefox 110+ **[Uncertain: from published support tables, not tested]**. It doesn't use the View Transitions API, so the many browsers without that API are not a concern.
- **Fallbacks it includes:** `requestIdleCallback` falls back to a timer, and `scrollIntoView({behavior:"instant"})` falls back for older Safari.
- **Fallbacks it lacks:**
  - There is no overall feature check. In a browser without `inert`, the neighbouring cards' links and buttons would become reachable by keyboard **[Code]**.
  - If JavaScript fails, plain-HTML (`scan`) sources fall back to ordinary links, which is good *if* they point at real pages. React sources simply do nothing.
- **Tested only in Chromium.** Safari is where I'd expect surprises **[Uncertain]**:
  - Safari's handling of `overflow: hidden` on `<html>` for scroll locking.
  - Its overscroll bounce interacting with drag-to-dismiss.
  - `scrollbar-gutter` support.
  - The touch gestures in general.

Test on a real iPhone before shipping.

## 6. What's done well (so you know what to keep)
- **Geometry is exact** on scrolled pages, at phone widths and under sticky headers, including turning a close back around mid-flight. The code also re-aims cards if the page scrolls during a close (not tested).
- **Interruptions are handled carefully.** Every transition can be reversed from wherever it is, keeping its speed, and nothing leaks.
- **Performance discipline:** it reads all layout up front and then writes, and moves things with transform and opacity rather than layout properties.
- **Reduced motion is designed, not bolted on:** a cross-fade everywhere, with instant paging.
- **Focus is placed sensibly** on open and close, and touch and wheel gestures are thoughtfully tuned.

## 7. Things I'm unsure about
- Behaviour in **Safari, Firefox and real phones**. Everything was measured in headless Chromium, with CPU slowdown standing in for a phone.
- Whether a **real** slow image shows the same 0-height behaviour in Safari and Firefox. In Chromium it does; I expect the same elsewhere, but haven't checked.
- How noticeable **M-6** (the startup freeze) is on real mid-range hardware.
- The **3–5 day** fix estimate.
- Screen-reader output: I checked the structure (roles, names, live regions) programmatically, but I didn't listen to VoiceOver or NVDA.

## 8. Files in this review
- `review/demo/zoom-demo.html`: the double-click demo. 8 labelled scenarios, slow motion, and a reduced-motion simulation plus instructions.
- `review/review-report.md`: this report.
- `review/evidence/*.png`: screenshots behind the findings.
- `review/harness/`: the test app, build script, probe scripts and the Playwright suite (`tests/review.spec.ts`). Round 2: 22 checks, 20 passing plus 2 known limitations marked "expected to fail". To rerun: `npm --prefix review/harness install`, then `npm test` from the repo root. `npm run demo` rebuilds the demo, with both library versions inside.
- Round 1 reviewed the library exactly as received (the first commit, minus the macOS archive leftovers `__MACOSX/` and `.DS_Store`). Round 2's fixes are in `src/zoom/`; see §0.
