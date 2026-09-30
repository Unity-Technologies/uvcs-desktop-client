/**
 * Whether the user asked the OS for less motion: movement run from code (scrolling, fading, a canvas's pings) is
 * skipped. CSS motion follows the `--duration-*` tokens, which reduced motion zeroes.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
