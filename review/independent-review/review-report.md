# Zoom transition library: independent review

**What I reviewed:** the library as it is now on this branch (`src/zoom/`, 10 files, about 3,700 lines). That is the version after several earlier rounds of AI-written fixes, not the zip as first imported. I did not change any library file.
**How:** I read every line of the library. I ran the type check and the repository's own browser test suite. Then I wrote my own test app and probes (`review/independent-review/`) and ran them in headless Chromium to confirm each problem below.
**Labels:** **[Confirmed]** = I reproduced it in a browser. **[Code]** = from reading the code, not reproduced. **[Uncertain]** = my best judgement; treat it as a question, not a fact.
**Biggest limit of this review:** Chromium was the only browser I had. Nothing here was tested in Safari, Firefox, or on a real phone, and headless Chromium's timings are only a rough guide to how a phone performs.

---

## Verdict

**Usable with fixes. It doesn't need a rewrite.** The hard parts are done well, and I confirmed them in the browser:
- The picture leaves from and lands on the right spot to within 1 px, on scrolled pages and at phone width.
- Interruptions are handled: rapid clicks, Esc or Back halfway, and clicking a card as it flies home all left nothing behind.
- Reduced motion is respected, and the switch works live, without a reload.
- Each frame moves things only with `transform` and `opacity` (plus a `clip-path`); it never animates `width`, `height`, `top` or `left`.
- After every transition, the page is cleaned up completely.

But one problem hits real sites directly. Normally the thumbnail and the big detail photo are different files, and the README's own example is set up that way. Then, the first time each card opens, **an empty grey box flies instead of the picture**, because the big photo has only just started downloading. Fix that, plus three Important issues, before relying on it:
- Opening a card does work for every card in the group, so a large gallery hitches at the moment of the tap.
- Sideways-scrolling content inside a card can't be scrolled.
- Keyboard focus isn't moved into the card if you hide the built-in close button.

Other cautions:
- It is one 2,400-line file with a lot of interlocking state.
- It was written, fixed, tested and documented by AI only.
- The repository's own test command fails if you follow the README's install steps.

If you or a developer will maintain it, budget time to own that complexity. If you only need a portfolio grid, compare it with the browser's built-in View Transitions API, which needs far less code (see "Uncertain").

---

## 1. Orientation, in plain language

**What it's built with**
- **React 19.** A JavaScript library for building web pages out of components. This library is a set of React components, so your site must use React (or at least render one React component on the page).
- **Motion 13** (formerly Framer Motion). An animation library. Here it's used only for its *springs*: motion that speeds up and settles like a physical spring, instead of following a fixed duration and easing curve.
- **Browser features it relies on:**
  - `transform` and `opacity`: the cheap way to move, scale and fade things.
  - `clip-path`: cropping the flying picture and the growing card.
  - `inert`: switches off everything behind the open card, so keyboard and screen-reader users can't wander into it.
  - `history.pushState`: changes the address bar without loading a page.
  - `matchMedia("prefers-reduced-motion")`: reads your device's Reduce Motion setting.
  - `ResizeObserver`: notices when the window changes size.
- **It does *not* use the View Transitions API**, the browser's newer built-in way to animate between pages. It also never actually navigates to another page.
- **No other dependencies.**

**How it works**
1. You wrap each thumbnail in `<ZoomSource id="…">`. Each detail "page" is a card drawn in an overlay on top of the *same* page, not a separate page.
2. In the detail content, you wrap the big image in `<ZoomHero>`.
3. When someone clicks a thumbnail, the library measures where it is and hides it.
4. It makes a temporary copy of the big image (the *flying copy* or *flight*). The copy flies from the thumbnail's position to the image's place in the card.
5. Meanwhile, the card grows out from around the picture and the page behind dims.
6. Closing runs the same thing backwards.
7. Items in the same group become a swipeable row of cards: neighbours peek in at the sides, and arrow keys or swipes move between them.
8. Optionally, the address bar changes to the item's address while it's open, and the browser's Back button closes it.

**How someone uses it**
```tsx
<ZoomProvider renderDestination={(id) => <Project id={id} />} getLabel={(id) => titleOf(id)}>
  <a href={`/work/${id}`} onClick={(e) => { e.preventDefault(); open(id); }}>
    <ZoomSource id={id}><img src={thumb} width={1200} height={800} alt="" /></ZoomSource>
  </a>
</ZoomProvider>
// inside <Project>: <ZoomHero><img src={big} width={1200} height={800} alt="…" /></ZoomHero>
```
Import `zoom.css` for the default look, or `zoom.base.css` to style everything yourself. Every option is documented in comments in `src/zoom/ZoomProvider.tsx` and summarised in `AGENTS.md`.

---

## 2. Issues

### Critical

**C1. On the first open of each card, an empty grey box flies instead of the picture.** [Confirmed]
- **What a user sees:** they tap a thumbnail and the thumbnail vanishes. An empty grey box zooms up in its place, with the image's description (alt text) printed in its corner. The photo pops in partway through, or after the card has landed.
- **When it happens:** only when the thumbnail and the big image are different files, which is the normal setup and the README's own example. Each card is affected the first time it opens; afterwards the browser has the photo, so it flies properly.
- **Measured:** I served the page with a delay on the detail photos. Share of the flight that showed no picture:

  | Delay before the photo arrives | Flight with no picture |
  |---|---|
  | 0 ms | 5% |
  | 100 ms | 14% |
  | 300 ms (typical phone connection) | 41% |
  | 1 s | 100% |

  Screenshot: `evidence/slow-takeoff.png`. Probe: `probes/first-open-network.mjs`.
- **Why:** the card's content (and so the big `<img>`) only starts loading when the card opens. The library checks that the image has a *size* (`canFly`). That passes when `width`/`height` are set. It never checks that the image has *loaded*, so it flies a copy of an image that hasn't arrived yet.
- **Where:**
  - `src/zoom/ZoomProvider.tsx:1506`: the take-off decision.
  - `src/zoom/flight.ts:94`: `canFly`.
  - `src/zoom/flight.ts:115`: `snapshotOf` copies the not-yet-loaded `<img>`.
- **Suggested fix:**
  - If the hero image isn't loaded at take-off, fly a copy of the *thumbnail* instead (it is already loaded), and switch to the hero once it arrives.
  - Or wait for `img.decode()` for up to about 100 ms before take-off.
  - Separately, preload the big image when the thumbnail scrolls into view or on hover/touchstart.
  - Workaround until it's fixed: use the same image file for thumbnail and hero.

### Important

**I1. Opening a card does work for every item in its group: a large gallery hitches at the moment of the tap and downloads every big photo.** [Confirmed]
- **What a user sees:** a short freeze between the tap and the start of the zoom, so the zoom feels sticky. The freeze grows with the number of items in the gallery.
- **Measured:** longest freeze, with the CPU slowed 4× (a rough stand-in for a mid-range phone):

  | Items in the gallery | Freeze before the zoom starts |
  |---|---|
  | 9 | 181 ms |
  | 24 | 266 ms |
  | 48 | 370 ms |

  At normal desktop speed, 48 items still produced a 66 ms freeze.
- **Data cost:** opening one card also requested *every* card's big photo at once (9 requests for a 9-item group). On a phone connection, that's wasted data, and it slows the one photo the visitor wants (which makes C1 worse).
- **Note:** items without a `group` all fall into one group called "default", so a page with unrelated zoomable things gets one big pager.
- **Where:**
  - `src/zoom/ZoomProvider.tsx:1433`: every item in the group is included.
  - `src/zoom/ZoomProvider.tsx:2357`: a full card is rendered for each.
- **Suggested fix:**
  - Render only the opened card and its immediate neighbours; render the rest when the visitor pages towards them.
  - Or render the neighbours after the card has landed.
- **Probe:** `probes/perf.mjs`.

**I2. Content inside a card that scrolls sideways can't be scrolled; the swipe switches to the next card instead.** [Confirmed]
- **What a user sees:** a photo strip, a wide table, a code sample or a map inside a detail card won't scroll sideways. A two-finger trackpad swipe, Shift + mouse wheel, or a finger drag over it slides to the next project instead. The strip moved 0 px in both tests.
- **Where:**
  - `src/zoom/gestures.ts:647`: every sideways wheel event is taken over for paging.
  - `src/zoom/gestures.ts:235`: every sideways finger drag starts paging.
- **Suggested fix:** before paging, check whether the event started inside an element that can still scroll that way. If it can, let the browser scroll it, and only page once it reaches its end.
- **Probe:** `probes/findings.mjs hscroll`. Demo scenario 7.

**I3. Keyboard focus isn't moved into the card if you don't use the built-in close button, and it's on nothing at all while a card opens.** [Confirmed]
- With `closeButton={false}`, focus stayed on the page itself ("BODY") after the card opened.
- The same happens with a custom close button that doesn't carry `data-zoom-close`, even though the documentation says calling `close()` is enough. [Code]
- **What a keyboard or screen-reader user experiences:** nothing announces that a dialog opened, and the first Tab lands somewhere unpredictable.
- **Even with the default button:** for the whole opening animation (about half a second), focus is on nothing. The thumbnail that had focus is switched off (made inert) the moment the card starts opening, and focus only moves to ✕ once the card has landed.
- **Where:**
  - `src/zoom/ZoomProvider.tsx:1625` and `:1656`: focus only goes to an element with `data-zoom-close`.
  - `src/zoom/ZoomProvider.tsx:1469`: the background is made inert at the start of opening.
- **Suggested fix:**
  - If there's no `[data-zoom-close]` element, focus the card itself (give it `tabindex="-1"`).
  - Move focus at the *start* of opening, not the end.
- **Probe:** `probes/findings.mjs focus`.

**I4. If the same item appears twice on a page, the zoom starts from the wrong copy.** [Confirmed]
- **What a user sees:** say a project is shown big as "Featured" and again in the grid. Click the featured picture: it stays put, and a picture flies in from the grid copy. In my test, that copy was below the bottom of the window, so the picture came up from off-screen.
- The documentation does say ids must be unique, but nothing warns you when they aren't, and "featured plus list" is a common layout.
- **Where:** `src/zoom/ZoomProvider.tsx:1311–1312`. Sources are stored by id, and the last one registered wins.
- **Suggested fix:**
  - Remember which element was clicked: `open(id, element)`, or look up the source nearest the click.
  - At least log a warning during development when two sources share an id.
- **Probe:** `probes/findings.mjs dupe`. Demo scenario 9.

**I5. One broken detail page blanks the whole website, even when you open a different item.** [Confirmed]
- **What happens:** I made item 5's content throw an error, then opened item 1. Because opening renders *every* card in the group (see I1), item 5's error took down the whole React app, and the page went blank.
- The library did correctly give back scrolling and interactivity.
- Normally a bug like this would only break item 5.
- **Where:** `src/zoom/ZoomProvider.tsx:599`. Each card's content is rendered without an error boundary (React's mechanism for containing a crash to one component).
- **Suggested fix:** wrap each card's content in an error boundary that shows a simple "couldn't load" message.
- **Probe:** `probes/findings.mjs throw`.

**I6. At the moment you click, every other thumbnail in the gallery blinks out.** [Confirmed]
- **What a user sees:** the clicked picture starts flying, and in the same instant all the other pictures in the grid disappear, leaving empty holes under their captions. They stay hidden until the card is closed. The holes are most noticeable on rows that the neighbouring cards don't cover. The neighbouring cards then fade in over the top row.
- Screenshots: `evidence/takeoff-30ms.png` and `evidence/takeoff-150ms.png`, slowed 4×.
- This is a deliberate default (`hideGroupWhileOpen`), there so a picture never shows twice. It reads as a flicker, though.
- **Where:** `src/zoom/ZoomProvider.tsx:1529` and `:1368`.
- **Suggested fix:**
  - Hide only the thumbnails the neighbouring cards will actually cover, and only once those cards are visible.
  - Or fade the others with the dim. The existing `groupOpacity` option already does something close to this; it could be the default.
- Demo scenario 1. Please judge this one yourself: it's partly a matter of taste.

**I7. No deep links: reloading, sharing, or arriving at an item's address shows the grid, not the open card.** [Confirmed, and documented by the library]
- With `history` turned on, the address changes to `#id` while a card is open. Reloading that address shows the grid with nothing open.
- The default `#id` address can't have a real page behind it, so the default setting is a trap. You must pass `url: (id) => "/work/" + id` and build real pages at those addresses (the README says so).
- Back, Forward, and Back pressed halfway through all work correctly. [Confirmed]
- **Where:** `src/zoom/ZoomProvider.tsx:802`.
- **Suggested fix:**
  - Make `url` required when `history` is on.
  - Optionally, open the matching card instantly (without animation) when the page loads at an item's address.

**I8. The repository's own test command fails if you follow the README.** [Confirmed]
- **What happens:** the README says to run `npm install && npm --prefix review/harness install`, then `npm test`. Doing exactly that, 33 of 35 browser tests failed and the test page was blank.
- **Why:** two copies of React get installed, and the test app bundles both.
- **After removing the extra copy:** all 35 tests passed. 33 pass outright. The other 2 are known limitations, marked "expected to fail" (deep links, and template inline code running), so Playwright counts them as passes because they fail.
- This doesn't affect visitors to your site. It does mean the safety net is broken for the next person who changes the code.
- **Where:** `review/harness/build.mjs:47` (`nodePaths` is only a fallback, so the library picks up the root copy of React).
- **Suggested fix:** in the test bundle, point `react` and `react-dom` explicitly at one copy (an esbuild `alias`), or don't install the root dependencies for tests.

### Minor

**M1. A thumbnail partly hidden under a sticky header pops out on top of the header.** [Confirmed; documented]
- At take-off, the hidden part appears over the header in the first frame. On closing, the picture lands on top of the header and then snaps underneath. Screenshot: `evidence/sticky-takeoff.png`.
- **Fix:** start the flying copy clipped to the part of the thumbnail that is actually visible below the header.

**M2. The ✕ button floats just outside the growing card during the first part of the opening.** [Confirmed in slow motion]
- It's faint, because it fades in with the zoom. It's placed relative to the full card, but early on only the part around the picture is visible. See `evidence/takeoff-150ms.png` (top right of the middle card).
- **Where:** `src/zoom/ZoomProvider.tsx:1176–1181`.
- **Fix:** clip the copy to the visible part of the card, or start fading it in a little later.

**M3. Each frame re-crops the card and the flying picture with `clip-path`.** [Confirmed that it happens; effect on phones Uncertain]
- Moving and fading are cheap (the graphics chip does them). Changing a `clip-path` on every frame makes the browser repaint the card each frame.
- In headless Chromium it held about 60 fps once moving. I couldn't measure a real phone. If you see stutter on a mid-range Android phone *during* the motion (as opposed to at the start; that's I1), this is the first suspect.
- **Where:** `src/zoom/ZoomProvider.tsx:1133`, `src/zoom/flight.ts:244`.

**M4. Closing onto a thumbnail that is off-screen scrolls the page instantly.** [Code; documented]
- Example: you open card 2, press → until you reach a card whose thumbnail is off-screen, then close. The page behind jumps to show that thumbnail before the card flies home.
- `src/zoom/ZoomProvider.tsx:1971`.

**M5. Resizing the window (or rotating a phone) during a zoom makes the zoom jump straight to its end.** [Confirmed by the existing tests]
- This is a deliberate trade-off: chasing a layout that's still changing looked worse. It is abrupt, though.
- `src/zoom/ZoomProvider.tsx:1926`.

**M6. Heroes that are videos, canvases or embedded frames probably restart or go blank while flying.** [Uncertain; Code]
- In the default "live" mode, the flying copy draws the hero's content a second time. A playing video would show its first frame, and an embedded map would reload.
- Pass `live={false}` for such heroes.

**M7. Pinch-to-zoom inside an open card may be blocked.** [Uncertain]
- The overlay sets `touch-action: pan-y` (`src/zoom/zoom.base.css:14`), which in some browsers stops pinch-zoom. That matters for people with low vision, and for anyone who wants a closer look at a photo.
- Check on a real phone.

**M8. If the overlay disappears while a card is open, focus isn't returned and the extra history entry stays.** [Code]
- This happens, for example, when a client-side route change removes the provider.
- Scrolling and interactivity *are* restored.
- `src/zoom/ZoomProvider.tsx:2253`.

**M9. Plain-HTML mode (`scan`) only finds thumbnails that exist when the page first loads.** [Code]
- Thumbnails added later (for example by "load more") don't zoom; they just follow their link as ordinary links. That's a graceful failure.
- `src/zoom/ZoomProvider.tsx:2277`.

**M10. Code quality** [Code]
- Almost everything is in one 2,412-line file (`ZoomProvider.tsx`).
- There are three near-duplicate "how open is this card" functions (`progressOf`, `activeProgress`, `visibleProgress`, lines 952–1221).
- A public timing option, `fadeOut`, is documented as unused (`springs.ts:18`).
- Opening a non-live hero (`live={false}`) copies every computed style of every element in it, which is slow. The earlier review's own probe measured 220–310 ms freezes with the CPU slowed 4×.

---

## 3. Your checklist, answered

**Correctness**
- **Start and end position:** correct to within 1 px.
  - Covered: top of page, scrolled page, phone width, an image inset in the card, and images whose shape differs from the thumbnail's (the crop changes smoothly). [Confirmed]
- **Responsive layouts:**
  - A thumbnail hidden by the layout makes its card fade out instead of flying to the screen corner. [Confirmed]
  - Resizing mid-zoom: see M5.
- **Late images:**
  - Without reserved size: the card opens without the flying picture, and nothing freezes. [Confirmed]
  - With reserved size but not yet downloaded: see C1.
- **Partly off-screen sources:** zooms from where they are. Closing onto one: see M4.
- **Fixed/sticky headers:** see M1.

**Interruptions**
- **Rapid clicks, double-clicks, Esc halfway, clicking a card as it flies home, arrow keys mid-zoom, and 25–30 random actions:** each left nothing behind. [Confirmed]
- **Back/Forward:** Back closes, and Forward reopens. [Confirmed]
- **Navigating away mid-transition:** cleans up scrolling and interactivity. See M8.
- **Deep links:** see I7.

**Performance**
- **What it animates:** only `transform`, `opacity` and `clip-path` change frame to frame. I recorded every style change during an open and close. It never animates `width`, `height`, `top` or `left`.
- **Layout recalculation:** about 11 in a whole open, not once per frame. Layout is measured once up front.
- **Weak spots:** the freeze at the start (I1) and per-frame repainting (M3).
- **60 fps on a mid-range phone:** I can't promise it. In my estimate the start of the zoom will hitch on a mid-range phone (I1), and the motion itself is probably fine. [Uncertain]

**Accessibility**
- **Reduced motion:**
  - Opening and closing become instant: no movement, no fade. [Confirmed]
  - Turning the setting on while the page is open takes effect without a reload. [Confirmed]
- **Focus:**
  - Moves to ✕ when open and returns to the thumbnail when closed. [Confirmed]
  - Tab can't reach the page behind. [Confirmed]
  - Gaps: see I3.
- **Screen readers:**
  - The open card is a dialog named after the item, and paging announces "Title, 2 of 9". [Confirmed in code and by attribute checks]
  - I didn't test with a real screen reader. [Uncertain]

**Cleanup**
- After every scenario, no flying copies were left, no hidden thumbnails, no locked scrolling, and no leftover inert flags. [Confirmed]
- Event listeners and timers are removed (checked by reading the code). [Code]
- A small amount of memory is kept per item ever opened. That's harmless.

**Browser support**
- **Not tested beyond Chromium.**
- There's no explicit fallback, and every feature it relies on is in current Safari, Firefox and Chrome. In older browsers, some features fail quietly:
  - Without `inert` (Safari before 15.5, Firefox before 112), keyboard focus can escape behind the card.
  - Without `scrollbar-gutter`, the page may shift sideways on desktops with visible scrollbars.
- **If JavaScript fails:** links with real `href`s still work as normal links.
- **Phone scrolling:** the scroll lock (`overflow: hidden` on the page) is known to be unreliable on older iPhones. [Uncertain]

**AI-generation problems**
- **Things that don't exist:** I found no functions or APIs that don't exist, and the type check passes.
- **Comments that overstate:**
  - The README's test instructions fail (I8).
  - The `closeButton` documentation implies `close()` is enough, but focus handling needs `data-zoom-close` (I3).
- **Tests:** a test suite exists (35 browser tests). It was written by the same AI that wrote the fixes, and a couple of tests count expected failures as passes.
- **Dead and duplicated code:** see M10.

**Security**
- `TemplateDestination` inserts the HTML of a `<template>` tag as live markup (`TemplateDestination.tsx:19`), so inline code like `onerror="…"` in that template *runs*. [Confirmed]
  - This is safe only if the templates contain your own markup, with anything visitors wrote escaped. The code comment says so.
  - Nothing else uses `innerHTML` with outside content.

---

## 4. Uncertain (my judgement, not verified)
- **Real phones and other browsers:**
  - How smooth it is on a real mid-range phone (M3, and the size of I1).
  - Safari and Firefox behaviour in general.
  - Pinch-zoom (M7).
  - The iPhone scroll lock.
- **What screen readers actually announce.** I only checked the dialog name and the announcement text.
- **Video and embedded heroes (M6).**
- **An alternative:** for a portfolio grid, the browser's built-in View Transitions API could produce a similar zoom with real page navigation (so deep links work for free) and far less code. As far as I know, it's now supported in current Chrome, Edge and Safari, with Firefox support recent. It would not give you the swipe-between-projects pager, the turn-around-mid-flight behaviour, or the per-corner crop blending this library has.

---

## 5. Files

| File | What it is |
|---|---|
| `review/independent-review/zoom-demo.html` | The double-click demo: 9 labelled scenarios, each with a checklist and a "Copy results" button |
| `review/independent-review/review-report.md` | This report |
| `review/independent-review/evidence/*.png` | Screenshots referenced above |
| `review/independent-review/probes/*.mjs` | The browser probes behind each [Confirmed] finding |
| `review/independent-review/demo-src/` | Source of the demo and probe app (uses `src/zoom` unchanged) |

To re-run:
- `npm --prefix review/harness install`. Don't also run the root `npm install`; see I8.
- `node review/independent-review/build.mjs`.
- `node review/independent-review/probes/findings.mjs`, and likewise `perf.mjs`, `first-open-network.mjs`, `sticky.mjs` and `demo-check.mjs`.
