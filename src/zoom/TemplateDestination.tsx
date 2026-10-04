import { useMemo } from "react";

/**
 * Destination content taken from a <template data-zoom-destination="id"> in the page.
 * This is how server-rendered content (an Astro page, Markdown, optimised images)
 * becomes the destination without being written in React. Mark its shared element
 * with a data-zoom-hero attribute.
 *
 * The template's HTML goes into the page as live markup when the card opens, so
 * inline event handlers in it (onerror, onclick…) run. Only put your own markup in
 * these templates, and escape anything visitors wrote (comments, reviews) before it
 * goes in, exactly as you would on the page itself.
 */
export function TemplateDestination({ id, className }: { id: string; className?: string }) {
  const html = useMemo(() => {
    const t = document.querySelector<HTMLTemplateElement>(`template[data-zoom-destination="${CSS.escape(id)}"]`);
    return t?.innerHTML ?? "";
  }, [id]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
