# Zoom transition

A thumbnail zooms into a card, and its image flies to its place inside the card. Close, and it flies back. Built with React and Motion.

```tsx
import { ZoomProvider, ZoomSource, ZoomHero, useZoom } from "./zoom";
import "./zoom/zoom.css";

export const Work = () => (
  <ZoomProvider renderDestination={(id) => <Project id={id} />} getLabel={(id) => titleOf(id)}>
    <Grid />
  </ZoomProvider>
);

function Grid() {
  const { open } = useZoom();
  return projects.map((p) => (
    <a key={p.id} href={`/work/${p.id}`} onClick={(e) => { e.preventDefault(); open(p.id); }}>
      <ZoomSource id={p.id}><img src={p.thumb} width={1200} height={800} alt="" /></ZoomSource>
      {p.title}
    </a>
  ));
}

function Project({ id }) {
  return <ZoomHero><img src={heroOf(id)} width={1200} height={800} alt="…" /></ZoomHero>;
}
```

**Two presentations**
- `presentation="cards"` (default): a horizontal pager. The whole group zooms open from the tapped item; neighbours peek in at the sides.
- `presentation="scroll"`: one continuous vertical column, for reading project after project (a portfolio). Only the tapped item grows; the rest of the page dims behind it, and the item you're reading leaves its place on the page empty, ready to fly back into.

**Good to know**
- **Reserve image sizes** with `width`/`height`. An image with no size yet can't fly; the card still opens, without the flying image. A detail image that has its size but is still downloading flies as the thumbnail's picture until it arrives.
- **The thumbnail and the card image can have different shapes.** The picture's crop changes smoothly in flight.
- **Close** with Esc, the ✕, a click outside the cards, scrolling past the top, or a downward swipe on touch.
- **Mice don't drag cards.** Dragging with a mouse selects text instead.
- **Content that scrolls sideways** inside a card (a photo strip, a wide table) scrolls first; a sideways swipe turns the page once it reaches its end.
- **Reduced motion** makes opening and closing instant.
- **Addresses:** `history={{ mode: "session" }}` gives each open card a `#id` address; reloading or sharing it opens that card. For real addresses, use `history={{ mode: "item", url: (id) => "/work/" + id }}` and give each project a real page there.

**Styling:** `zoom.css` is the structure plus a default look. To style it all yourself, import `zoom.base.css` alone. Or keep the look and change it with `--zoom-card-bg`, `--zoom-card-radius`, `--zoom-dim-color` and friends; your own CSS always wins.

**Commands**
```sh
npm install && npm --prefix review/harness install
npm test             # browser checks
npm run demo:serve   # demo on your network (open it on a phone)
```

**More detail:**
- Every option: `AGENTS.md`, or the comments in `src/zoom/ZoomProvider.tsx`.
- How the library was reviewed and fixed: `review/independent-review/review-report.md` (latest), and `review/review-report.md` (the first rounds).
- Try it: open `review/independent-review/zoom-demo.html` in a browser.
