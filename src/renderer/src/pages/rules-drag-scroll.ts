// Dragging a rule near the top or bottom of the visible list scrolls the
// page (spec 18, F36), faster the closer the pointer is to the edge.

import { useEffect, type RefObject } from "react";

/** How far from an edge, in pixels, scrolling starts. */
const EDGE = 80;
/** Pixels per frame with the pointer right at (or past) the edge. */
const MAX_SPEED = 22;

/** Pixels to scroll this frame: negative scrolls up, 0 away from the edges. */
export function edgeScrollSpeed(pointerY: number, top: number, bottom: number): number {
  const intoTop = top + EDGE - pointerY;
  const intoBottom = pointerY - (bottom - EDGE);
  if (intoTop > 0) return -Math.round(MAX_SPEED * Math.min(1, intoTop / EDGE));
  if (intoBottom > 0) return Math.round(MAX_SPEED * Math.min(1, intoBottom / EDGE));
  return 0;
}

/** While `dragging`, scrolls the page that holds `list` when the pointer nears its edges. */
export function useDragAutoScroll(dragging: boolean, list: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const scroller = list.current?.closest("main");
    if (!dragging || !scroller) return;
    let pointerY: number | null = null;
    let frame = 0;
    const onDragOver = (e: DragEvent) => {
      pointerY = e.clientY;
    };
    const step = () => {
      if (pointerY !== null) {
        const box = scroller.getBoundingClientRect();
        // The sticky top bar covers the page's top, so the list's visible top is below it.
        const top = scroller.querySelector("header")?.getBoundingClientRect().bottom ?? box.top;
        scroller.scrollTop += edgeScrollSpeed(pointerY, top, box.bottom);
      }
      frame = requestAnimationFrame(step);
    };
    document.addEventListener("dragover", onDragOver);
    frame = requestAnimationFrame(step);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      cancelAnimationFrame(frame);
    };
  }, [dragging, list]);
}
