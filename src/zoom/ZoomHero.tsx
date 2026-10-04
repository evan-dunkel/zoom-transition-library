import { useContext, useLayoutEffect, type HTMLAttributes, type ReactNode } from "react";
import { ZoomCardContext } from "./ZoomProvider";

export type ZoomHeroProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  /**
   * Render the hero's real React content while it flies (default), so anything
   * inside it can keep animating with useZoomProgress(). Set false to fly a still
   * snapshot instead. Live heroes should be styled by their own classes: in
   * flight they sit outside the card, so selectors like ".card .hero" won't match
   * (the className you give ZoomHero is kept).
   */
  live?: boolean;
};

/**
 * Marks the shared element inside destination content: the part that flies
 * on its own path from the source and lands here. Without one, the card
 * still zooms from the source; it just has no separate flying element.
 *
 * Reserve its size (img width/height or CSS aspect-ratio): a hero with no size yet
 * (an image still downloading) can't fly, and the card opens without it. If the hero
 * is a single image (img/video with object-fit: cover, or an SVG with
 * preserveAspectRatio "slice"), the whole picture flies and its crop changes smoothly
 * from the source's to the hero's; the source should show the same picture, centred.
 */
export function ZoomHero({ children, live = true, className, style, ...rest }: ZoomHeroProps) {
  const card = useContext(ZoomCardContext);
  useLayoutEffect(() => {
    card?.setHeroContent({ children, className, style, live });
  });
  useLayoutEffect(() => () => card?.setHeroContent(null), [card?.id]);
  return (
    <div {...rest} className={className} style={style} data-zoom-hero="" ref={(el) => card?.setHero(el)}>
      {children}
    </div>
  );
}
