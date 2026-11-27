import { formatShortcut } from '../../lib/shortcuts';

/** Settings' review mode choice, naming the key that marks a file (R, or the one a person gave it), when it has one. */
export function reviewModeLabel(reviewKey: string | undefined, mac: boolean): string {
  const label = 'Review mode in this workspace: mark files as you review them, in Changes and every diff';
  return reviewKey ? `${label} (${formatShortcut(reviewKey, mac).join('')})` : label;
}
