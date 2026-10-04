# Zoom transition library: independent review

**What I reviewed:** the library on this branch (`src/zoom/`, 10 files, about 3,700 lines), as it was after several earlier rounds of AI-written fixes (not the zip as first imported). The review itself changed no library file. **Round 3** (below) then fixed the issues at your request; the rest of the report describes the library *before* those fixes, and the Round 3 table says what changed for each issue.
**How:** I read every line of the library. I ran the type check and the repository's own browser test suite. Then I wrote my own test app and probes (`review/independent-review/`) and ran them in headless Chromium to confirm each problem below.
**Labels:** **[Confirmed]** = I reproduced it in a browser. **[Code]** = from reading the code, not reproduced. **[Uncertain]** = my best judgement; treat it as a question, not a fact.
**Biggest limit of this review:** Chromium was the only browser I had. Nothing here was tested in Safari, Firefox, or on a real phone, and headless Chromium's timings are only a rough guide to how a phone performs.

---

## Verdict

**After Round 4: usable for your portfolio, with the caveats below.** Every Critical and Important issue is fixed and covered by a browser test, and the vertical scroll mode you described is in (Round 4). Before the fixes, my verdict was:

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
- Once a transition ends, focus is moved even if the visitor has already clicked somewhere else, so their typing goes to the wrong place (I9, found from your demo results).

Other cautions:
- It is one 2,400-line file with a lot of interlocking state.
- It was written, fixed, tested and documented by AI only.
- The repository's own test command fails if you follow the README's install steps.

If you or a developer will maintain it, budget time to own that complexity. If you only need a portfolio grid, compare it with the browser's built-in View Transitions API, which needs far less code (see "Uncertain").

**What still holds after the fixes:**
- Still tested only in headless Chromium, not in Safari, Firefox or on a real phone.
- The file is now about 2,700 lines, and the fixes were also written by AI. The new tests reduce the risk, but don't remove it.
- The smaller limitations listed as "remains" in the Round 3 table.

---

## Round 4: your third results, and the vertical scroll mode

### Your notes, followed up

Each fix has a browser test in `review/harness/tests/fixes.spec.ts`. The new tests fail on the previous version (Round 3), except two that guard things already right there: the column keeping its place as cards load (the old version built them all at once), and the slow-motion speed handling (fixed in Round 3).

| Your note | What I found | Change | Verified |
|---|---|---|---|
| Sticky header: on landing, a shorter element with rounded top corners below the header, then a pop to full height | **Confirmed regression from Round 3.** The cut at the header was rounded like the picture's own corners. | The cut is now a straight edge on a wrapper around the flying picture (and on the card's content), so the picture keeps its full height and its own rounded corners, and simply disappears under the header line, exactly like the real thumbnail. | Test: at take-off and landing, cut at the header line, full height, corner radii 14 px. |
| Phone, first open: the neighbouring cards still appear partway in | **Confirmed.** My earlier measurement used a 1× screen. On a 2× screen the first open's opening frame takes 83 ms (17 ms on later opens) while the browser prepares the big images, and the springs, already running, jumped ahead. | The motion now waits until the visible cards' pictures are ready (120 ms at most) with the picture sitting on its thumbnail, then plays from the start. | Slowest frame on the first open at 2× now 17 ms (was 83 ms). |
| New tab and reload didn't reopen the card (`#/walks/rapid-1`) | That address was the link's own `href`. The library only recognised its default `#rapid-1` form. | Any address on the same page (the default, or your own `#…` form) now opens its card on load and is cleared on close. The demo's history uses the links' own addresses. | Test with `#/walks/…`; in the demo file itself: new tab, reload, and a link opened in a new tab all open the card. |
| Slow photos: a grey box for about 1 s after the thumbnail's picture lands | **Confirmed.** The stand-in only covered the flight. | The card's image shows the thumbnail's picture as its background until the big photo arrives, in the opened card and in its neighbours. | Test: background present while the photo is held back, gone once it arrives. Screenshot: `evidence/slow-after-landing.png`. |
| Strip at its end: the mouse had to move before a new swipe would turn the page | **Confirmed.** macOS keeps sending the old swipe's momentum until the pointer moves, and I waited for a pause. | The end of a strip now uses the same "new swipe or momentum?" detection as page turns. | Test: momentum swallowed, then a new swipe with the mouse unmoved turns the page. |
| ✕ scales and drifts in with the card | Unchanged in the horizontal mode (you asked to keep it as is); it's a judgement item in the demo. In the scroll mode the ✕ copy now rides the top of the visible part of the card, where the real button sticks. | | |
| "Unloaded items are just immediately visible" on close | That's the Round 3 change: cards that were never built, or whose thumbnail is off screen, fade instead of flying. You said you'd tweak it; the scroll mode below is that tweak. | | |

**Also found and fixed while testing these:** turn-arounds could still stop cards dead at normal speed after a slow frame.
- **Cause:** Motion reports a value's speed as zero once it hasn't changed for 30 ms, which is common on phones. Round 3 only fixed the slow-motion cause.
- **Fix:** the library now reads the speed samples Motion keeps itself, and trusts them for up to 300 ms (`velocityOf`).
- **Tests:** two direct tests, each confirmed to fail with its cause put back. A frame-watching test turned out too noisy on a busy test machine to tell the bug from uneven frames, so I replaced it.

### The new vertical scroll mode: `presentation="scroll"`

What you described, as one option; the horizontal mode (`"cards"`, the default) is unchanged.
- **One continuous column.** Each card is as tall as its content, with no friction or snapping between cards; the column scrolls like a page. (This is the existing `layout="stream"`.)
- **Only the tapped item grows** into its card. Its picture flies, and the card grows out from around it, limited to the part that will be on screen. The other cards stay in place and fade in.
- **The page behind:** the rest of the group dims to 0.2 in step with the flight, and the tapped item's place is empty once it lands.
- **Reading on:** scrolling to the next project swaps which thumbnail is empty. The new one fades out, and the previous one fades back to 0.2.
- **Closing:** the visible card flies back into its empty place. Its visible window slides back up to the picture if you were reading far down. The neighbouring cards fade and shrink a little where they are, without flying, and the page fades back to full.
- **Loading:** cards are built lazily (the opened one and its neighbours first). The column's scroll is adjusted as cards are added above, so what you're reading doesn't move.
- **Tunable:** the dim level (`groupOpacity`), and everything else, can still be set individually.

Screenshots: `evidence/scroll-1-opening.png` to `scroll-5-closed.png`, and `evidence/scroll-close-*.png` for a close from far down a case study. Tests: three in `fixes.spec.ts`.

**Still open:** this mode needs your eye on real content (case studies of real length, real images), and a real phone.

---

## Round 3: the fixes

You asked me to fix the issues, set page turns to 0.25 s with no bounce, and remove unused code. Library changes are in `src/zoom/`; tests are in `review/harness/tests/fixes.spec.ts`.

**How each fix was verified:**
- Each fix has a browser test. I ran every new test against the library as it was *before* the fixes: all 15 failed there, and they all pass now.
- The whole suite (49 tests) passes, including the 34 earlier ones.
- The new tests passed 5 runs in a row with 4 running at once, to rule out timing flukes.
- I re-ran every probe from this report.

| # | Issue | Status | What changed | Measured after |
|---|---|---|---|---|
| C1 | Empty grey box flies on a first open | **Fixed** | While the big image downloads, the copy shows the thumbnail's own picture (an `img`, or an inline `svg`), then switches to the big image when it arrives. The live hero stays hidden behind it until its image has loaded. (`flight.ts`: `sourcePicture`, `createFlight`) | 0% blank frames at every delay tested, from 0 ms to 1 s (was up to 100%). `evidence/slow-takeoff-after.png` |
| I1 | Opening freezes, worse with gallery size; downloads every photo | **Fixed** | Opening builds only the opened card and its two neighbours. The rest are built after landing, three at a time while idle. On closing, cards whose thumbnail is off screen fade instead of flying. (`S.ready`, `fillCards`) | Freeze at the tap, CPU 4× slower (median of 3 runs, before → after): 9 items 159 → 130 ms, 48 items 425 → 158 ms. Closing, 48 items: 205 → 94 ms. The first open at phone width is now smooth from the first frame. |
| I2 | Sideways content in a card can't scroll | **Fixed** | A strip or table that can still scroll that way gets the swipe (trackpad, wheel and touch); paging resumes at its end. The rest of a swipe that hit the end doesn't turn the page. (`gestures.ts`: `canScrollX`) | Strip scrolled 360 px (trackpad) and 184 px (touch); card unchanged |
| I3 | Focus not moved into the card without a ✕; focus on nothing during opening | **Fixed** | Focus moves at the start of opening, to the `[data-zoom-close]` element, or to the card itself if there isn't one (`focusCard`). | Focus is inside the dialog at 50 ms, both with and without the ✕ |
| I4 | Same item twice: zoom starts from the wrong copy | **Fixed** | Every copy is remembered. Opening uses the copy that was clicked or focused, and the card lands back on it. (`pickSources`) | Starts within 1 px of the clicked featured tile |
| I5 | One broken item blanks the page | **Fixed** | Each card's content, and its flying copy, is wrapped in an error boundary that shows "This item couldn't be shown." (`DestinationBoundary`) | Page and other items keep working |
| I6 | Other thumbnails blink out at the tap | **Fixed** | They now fade out as the card opens and back as it closes. `hideGroupWhileOpen` (default) uses the existing `groupOpacity` mechanism at 0. | Only the clicked thumbnail is hidden at take-off. `evidence/takeoff-30ms-after.png` |
| I7 | No deep links | **Fixed for `#id` addresses** | A page loaded at an item's `#id` (the default address) opens that card instantly; closing removes the `#id` from the address. Your own URLs (`/work/slug`) still need real pages. | Reloaded `#rapid-3` opens `rapid-3`; the next open flies normally |
| I8 | Test command fails with the README's install steps | **Fixed** | The test and demo bundles always use one copy of React. | Suite passes after `npm install && npm --prefix review/harness install` |
| I9 | Focus taken back after the visitor moved on | **Fixed** | Focus moves only from where the library left it, and never into a frame that doesn't have focus (`mayMoveFocus`). | Typed "abcd" stays in the search box |
| M1 | Picture pops over a sticky header | **Fixed (mostly)** | At open and close, the library finds what covers each on-screen thumbnail. The flying picture and its card stay below that header near the thumbnail, opening out over the first third of the zoom. **Remains:** the faint neighbouring cards can pass over the header for a moment. | Flying copy starts at y = 59, just below the 60 px header (was −27). `evidence/sticky-takeoff-after.png` |
| M2 | ✕ floats outside the growing card | **Fixed** | The ✕ copy is clipped to the card's current shape. | Before and after: `evidence/takeoff-150ms.png`, `evidence/takeoff-150ms-after.png` |
| M3 | `clip-path` repainted every frame | Remains | Not changed. It needs a real phone to judge. | |
| M4 | Off-screen thumbnail: page scrolls instantly on close | Remains | Deliberate trade-off, kept. | |
| M5 | Resize mid-zoom jumps to the end | Remains | Deliberate trade-off, kept. | |
| M6 | Video, canvas or iframe heroes in a live flight | Remains | Documented: use `live={false}` for those. | |
| M7 | Pinch-zoom possibly blocked | **Fixed** (untested on a phone) | `touch-action: pan-y pinch-zoom`. | |
| M8 | Unmount while open doesn't return focus | **Fixed** | Focus goes back to the opener. The extra history entry is left alone on purpose: removing it would undo the navigation that caused the unmount. | |
| M9 | Plain-HTML mode misses thumbnails added later | **Fixed** | The page is watched; new `[data-zoom-source]` elements are picked up, and removed ones let go. | Test: a tile added after load opens |
| M10 | Unused and duplicated code | **Fixed** | Removed the unused `fadeOut` timing option, the duplicate `activeProgress` (merged into `progressOf` and `visibleProgress`), the "hide the whole group at once" branch the new fade replaced, and an unused `side` field. I checked every remaining declaration for references; nothing else is unused. | |
| M11 | Turn-around stops fast cards dead | **Fixed** | The cause was in slow motion only: speeds were handed to springs that run on a slowed clock, without converting. `springTo` now converts. At normal speed, turn-arounds already carried their speed. | 0 jerks across 4 turn-arounds at ×0.1 (829 frames) |
| M12 | Page turns creep | **Fixed** | `timing.page` is now 0.25 s, no bounce (it was 0.5 s). | 90% there at 175 ms; fully at rest at about 475 ms (was 332 ms and 850 ms) |
| M13 | ✕ on every card | **Fixed** | The default theme hides the ✕ on inactive cards. | Only the visible card's ✕ is shown |

**Changed defaults to know about:**
- `timing.page` is 0.25 s.
- The rest of the group fades out with the opening instead of disappearing at once.
- Opening from an `#id` address on page load opens the card.
- Card content for the rest of the group is built after landing. If your content runs code when it mounts, that now happens a moment later.

**Docs:** `README.md`, `AGENTS.md` and the option comments in `ZoomProvider.tsx` are updated. The current demo is `review/independent-review/zoom-demo.html`. The first review's demo (`review/demo/`) is left as it was; its notes describe that earlier round.

---

## Round 2: your demo results (Dia on a MacBook Air M5), followed up

You confirmed every "Problem I found" item and every "Should work" item, except the four below. I reproduced each of your observations in the browser before acting on it.

| Your note | What I found | Where in this report |
|---|---|---|
| Page turns (← →) are too slow, with too much tail | **Confirmed.** A page turn is 90% of the way there at 332 ms, but keeps creeping until about 850 ms. | New **M12**, with tested settings |
| Phone width, first open only: the other items "instantly appear in flight already in the horizontal row" | **Confirmed.** On the first open, the first frame takes about 100 ms, so the neighbouring cards appear already partway faded in. Later opens are smooth from the first frame (17 ms frames). This is the start-up cost in **I1**, worst on the very first open. | Added to **I1** |
| Click, Esc, click, Esc in very slow motion: cards jump left and right, and flicker | **Confirmed.** When a close is turned around, cards that were moving fast stop dead in one frame and then speed up the other way, instead of curving back. The card you clicked moves slowly at that point, so it looks fine; the far ones visibly jerk. They do end up in the right place. | New **M11** |
| When things settle, focus is taken away from me typing here | **Confirmed, and it affects real pages too.** I clicked a search box on the page while a card flew home and typed "ab". When the card landed, the library moved focus back to the thumbnail, so the next keystrokes ("cd") went to the thumbnail instead of the box. In the demo, it pulled focus out of the checklist into a frame. | New **I9** |
| Show the ✕ only on the active card, not on every card | Agreed. It's a design issue: the neighbouring cards show their own ✕, but those buttons do nothing until that card becomes the active one. | New **M13** |
| 48-item gallery: 33 ms slowest frame, only slightly hesitant | That fits: an M5 is far faster than a mid-range phone. The same test with the CPU slowed 4× froze for 370 ms. | **I1** |

The demo now has a "Page turn" switch at the top so you can compare timings yourself, and a general-notes box above "Copy results".

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
- **Worst on the very first open** (found from your demo results): at phone width, the first frame of the first open took about 100 ms, so the neighbouring cards appeared already partway faded in. Later opens ran at 17 ms per frame from the start. [Confirmed]
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

**I9. Focus is moved after a transition ends, even if the visitor has already moved on.** [Confirmed; found from your demo results]
- **What a user sees:** while a card is flying home, the page behind is live again. Say a visitor clicks a search box and starts typing. When the card lands, the library moves focus to the thumbnail, so the rest of their typing goes nowhere useful. In my test, "ab" went into the box and "cd" didn't.
- The same happens at the end of opening (focus moves to ✕). That's how the demo pulled focus out of your checklist and into a frame.
- **Where:**
  - `src/zoom/ZoomProvider.tsx:2067`: on landing, focus goes back to the thumbnail.
  - `src/zoom/ZoomProvider.tsx:1625`: after opening, focus goes to ✕.
- **Suggested fix:** only move focus if it is still where the library left it (inside the card, on the page body, or on the element that opened the card). Never take it from a field the visitor has chosen since.
- **Probe:** `probes/round2.mjs focus-steal`.

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

**M11. Turning a close around makes fast-moving cards stop dead, then reverse.** [Confirmed in slow motion; found from your demo results]
- **What a user sees:** you close a card and click it again while it's flying home. The cards near it turn around smoothly. Cards further away were moving fast (about 25 px per frame at ×0.1 speed); they stop in a single frame and then speed up the other way. After several interruptions in a row, the cards visibly jerk left and right before settling in the right place.
- **Why:** the new springs should start with each card's current speed, and the code tries to pass it on, but for those cards it arrives as zero. The exact cause is **Uncertain**: my best guess is that the speed reads as zero when the turn-around starts from a click rather than from inside an animation frame.
- **Where:** `src/zoom/ZoomProvider.tsx:1686–1717` (`bake`, which reads each card's speed) and `:1839–1846` (where it is handed to the new springs).
- **Fix:** record each card's speed on every animation frame, and use the last recorded value at a turn-around, instead of asking for it at the moment of the click.
- **Probe:** `probes/turnaround.mjs`, `probes/round2.mjs interrupt`.

**M12. Page turns (← →, swipes) take too long to settle.** [Confirmed; found from your demo results]
- The spring is tuned to iOS's "smooth" curve (`timing.page`, `src/zoom/springs.ts:24`). A page turn is 90% done at 332 ms, then creeps the last few pixels until about 850 ms. On a desktop display that reads as sluggish.
- **This is a setting, not a code change.** Measured in the browser for a 728 px page turn:

  | `timing.page` | 90% there | Fully at rest |
  |---|---|---|
  | `{ duration: 0.5, bounce: 0 }` (default) | 332 ms | ~850 ms |
  | `{ duration: 0.35, bounce: 0 }` | 244 ms | ~630 ms |
  | `{ duration: 0.3, bounce: 0.1 }` | 183 ms | ~520 ms |

- Try them with the demo's new "Page turn" switch. Pass your pick as `timing={{ page: { duration: 0.3, bounce: 0.1 } }}` on `<ZoomProvider>`.

**M13. Every card shows its own ✕, including the neighbours peeking in at the sides.** [Confirmed; design point from your demo results]
- Only the active card's ✕ does anything (the neighbours are switched off), so the extra buttons are visual noise, and they look like they should work.
- **Where:** `src/zoom/ZoomProvider.tsx:597` (every card renders the button).
- **Fix:** a one-line style rule hides it on inactive cards, for example in your own CSS: `.zoom-card[inert] .zoom-close-bar { opacity: 0; }`. Better still, the library's default theme should include it. You may want it to fade in as a card becomes active.

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
  - Gaps: see I3, and I9 (focus taken back after the visitor has moved on).
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
| `review/independent-review/zoom-demo.html` | The double-click demo: 9 labelled scenarios, each with a checklist, a page-turn timing switch, a general-notes box and a "Copy results" button |
| `review/independent-review/review-report.md` | This report |
| `review/independent-review/evidence/*.png` | Screenshots referenced above (`*-after.png`: the same moment after the Round 3 fixes) |
| `review/independent-review/probes/*.mjs` | The browser probes behind each [Confirmed] finding |
| `review/harness/tests/fixes.spec.ts` | Browser tests for the Round 3 fixes (run with `npm test`) |
| `review/independent-review/demo-src/` | Source of the demo and probe app (uses `src/zoom` unchanged) |

To re-run:
- `npm --prefix review/harness install`. Don't also run the root `npm install`; see I8.
- `node review/independent-review/build.mjs`.
- `node review/independent-review/probes/findings.mjs`, and likewise `perf.mjs`, `first-open-network.mjs`, `sticky.mjs`, `round2.mjs`, `turnaround.mjs`, `cost-median.mjs` and `demo-check.mjs`.
