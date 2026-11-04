/**
 * The Branch Explorer's Timeline: an activity curve over two axes, stroked on a 24-unit grid like Lucide's icons, so it
 * sits beside them at any size. It fits `Icon` (`lib/actions.ts`), so a command or a menu can name it as one.
 */
export function TimelineIcon({ size = 15, strokeWidth = 2, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M3 4v16h18" />
      <path d="M6 15c2-1 3-6 5-6s2 4 4 4 3-5 5-7" />
    </svg>
  );
}
