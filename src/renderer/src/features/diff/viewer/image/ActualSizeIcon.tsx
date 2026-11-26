/**
 * "1:1", the mark image tools give showing an image at its actual size: one pixel of it to one of the screen. Drawn in
 * strokes as Lucide draws its icons, so it has their weight and no font decides how it looks. Lucide's `Scan` is four
 * corners like `Maximize` (Zoom to fit) beside it, and the two read as one.
 */
export function ActualSizeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8l2.5-2v13" />
      <path d="M12 10v.01M12 15v.01" strokeWidth={2.5} />
      <path d="M17.5 8l2.5-2v13" />
    </svg>
  );
}
