import { createLucideIcon } from 'lucide-react';

/**
 * The strikethrough format's icon, drawn for the comment toolbar on Lucide's 24px grid with its 2px stroke. Lucide's
 * own S leans right and sits off center beside its Bold B and Italic I; this S is symmetric about the grid's center
 * (x 7 to 17, the B's height, y 4 to 20), its halves meeting under the bar.
 */
export const StrikethroughIcon = createLucideIcon('comment-strikethrough', [
  ['path', { d: 'M17 7.5A3.5 3.5 0 0 0 13.5 4h-3A3.5 3.5 0 0 0 7 7.5c0 1.6 1 2.8 2.6 3.4', key: 'top' }],
  ['path', { d: 'M14.4 13.1c1.6.6 2.6 1.8 2.6 3.4a3.5 3.5 0 0 1-3.5 3.5h-3A3.5 3.5 0 0 1 7 16.5', key: 'bottom' }],
  ['line', { x1: '4', x2: '20', y1: '12', y2: '12', key: 'bar' }],
]);
