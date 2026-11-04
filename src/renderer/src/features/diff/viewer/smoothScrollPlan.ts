/**
 * How a diff scrolls smoothly to a place far away: a smooth scroll over thousands of lines takes seconds, and Pierre
 * renders every line it passes (a click on the change map from the top of an expanded file to its end took 3 s). So it
 * jumps at once to a quarter of a view short of the place (`GLIDE_SHARE`), on the side it comes from, and glides the
 * rest: the eye still sees which way it went, and the scroll settles in about a quarter of a second. A place within a
 * view glides the whole way; under reduced motion, it jumps.
 */

/** The share of a view glided at the end of a long scroll: enough to see which way it went, short enough to settle at once. */
export const GLIDE_SHARE = 0.25;

export interface SmoothScrollPlan {
  /** Where to jump at once first; none when the glide starts from where the view is. */
  jumpTo: number | null;
  /** Where to glide to then; none under reduced motion, which only jumps. */
  glideTo: number | null;
}

export interface SmoothScrollRequest {
  from: number;
  to: number;
  viewHeight: number;
  /** How far the view can scroll (`scrollHeight - clientHeight`). */
  maxScroll: number;
  reducedMotion: boolean;
}

export function smoothScrollPlan({ from, to, viewHeight, maxScroll, reducedMotion }: SmoothScrollRequest): SmoothScrollPlan {
  const target = Math.min(Math.max(0, to), Math.max(0, maxScroll));
  if (reducedMotion) return { jumpTo: target, glideTo: null };
  if (Math.abs(target - from) <= viewHeight) return { jumpTo: null, glideTo: target };
  const glide = viewHeight * GLIDE_SHARE;
  const short = target > from ? target - glide : target + glide;
  return { jumpTo: Math.min(Math.max(0, short), Math.max(0, maxScroll)), glideTo: target };
}

/** Scrolls `element` as `smoothScrollPlan` plans it. */
export function scrollSmoothlyTo(element: HTMLElement, to: number, reducedMotion: boolean): void {
  const plan = smoothScrollPlan({ from: element.scrollTop, to, viewHeight: element.clientHeight, maxScroll: element.scrollHeight - element.clientHeight, reducedMotion });
  if (plan.jumpTo !== null) element.scrollTo({ top: plan.jumpTo, behavior: 'auto' });
  if (plan.glideTo !== null) element.scrollTo({ top: plan.glideTo, behavior: 'smooth' });
}
