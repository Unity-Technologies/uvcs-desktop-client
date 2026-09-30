/** Whether the user asked the OS for less motion: movement the viewer runs from code (scrolling, fading) is skipped. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
