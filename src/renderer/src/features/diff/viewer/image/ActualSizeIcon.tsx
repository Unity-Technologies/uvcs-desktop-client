/**
 * "1:1", the mark image tools give showing an image at its actual size: one pixel of it to one of the screen. Lucide's
 * `Scan`, drawn before, was four corners like `Maximize` beside it (Zoom to fit), and the two read as one.
 */
export function ActualSizeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="600" fontFamily="var(--font-ui)" fill="currentColor">
        1:1
      </text>
    </svg>
  );
}
