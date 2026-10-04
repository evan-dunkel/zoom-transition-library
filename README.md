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

**Good to know**
- **Reserve image sizes** with `width`/`height`. An image that hasn't loaded yet can't fly; the card still opens, without the flying image.
- **The thumbnail and the card image can have different shapes.** The picture's crop changes smoothly in flight.
- **Close** with Esc, the ✕, a click outside the cards, scrolling past the top, or a downward swipe on touch.
- **Mice don't drag cards.** Dragging with a mouse selects text instead.
- **Reduced motion** makes opening and closing instant.
- **For real addresses**, add `history={{ mode: "item", url: (id) => "/work/" + id }}` and give each project a real page there, so links and reloads work.

**Styling:** `zoom.css` is the structure plus a default look. To style it all yourself, import `zoom.base.css` alone. Or keep the look and change it with `--zoom-card-bg`, `--zoom-card-radius`, `--zoom-dim-color` and friends; your own CSS always wins.

**Commands**
```sh
npm install && npm --prefix review/harness install
npm test             # browser checks
npm run demo:serve   # demo on your network (open it on a phone)
```

**More detail:**
- Every option: `AGENTS.md`, or the comments in `src/zoom/ZoomProvider.tsx`.
- How the library was reviewed and fixed: `review/review-report.md`.
