import { createLucideIcon } from 'lucide-react';

/**
 * The New attribute button's icon: Lucide's `Tags` (the Attributes view's) with a plus, as `TagPlus` is `Tag` with one.
 * Lucide draws no "tags plus", so this is `Tags` on its 24px grid with its 2px stroke, the front tag opened at its
 * bottom right corner (from y 14.5 down to the rounded bottom) for the plus at x and y 16 to 22, as `TagPlus` opens its
 * tag for its plus.
 */
export const NewAttributeIcon = createLucideIcon('new-attribute', [
  ['path', { d: 'M13.296 17.296l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1h6.172a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408L19.5 14.5', key: 'front' }],
  ['path', { d: 'M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193', key: 'back' }],
  ['circle', { cx: '10.5', cy: '6.5', r: '.5', fill: 'currentColor', key: 'hole' }],
  ['path', { d: 'M19 16v6', key: 'plus-vertical' }],
  ['path', { d: 'M16 19h6', key: 'plus-horizontal' }],
]);
