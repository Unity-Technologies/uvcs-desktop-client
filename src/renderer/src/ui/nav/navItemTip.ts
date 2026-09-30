/** What a sidebar entry says: what shows on it, and what only its tooltip tells. */
export interface NavItemWords {
  label: string;
  /** Quiet text beside the label, e.g. "Cloud"; the rail's tile leaves it out. */
  detail?: string;
  /** A count, e.g. pending changes. */
  badge?: number;
  /** What waits there, shown as a dot; its words go under the tooltip's (`data-tip-sub`). */
  dot?: string;
  /** Shown beside the tooltip's words (`data-tip-shortcut`). */
  shortcut?: string;
}

/**
 * The tooltip's words for a sidebar entry, or none when they would only repeat what the entry shows. Wide and in the
 * rail alike the label shows, so the tooltip names the entry only to carry what it adds: the shortcut or the dot's
 * words, and in the rail the detail the tile leaves out and the count its small badge squeezes.
 */
export function navItemTip(words: NavItemWords, rail: boolean): string | undefined {
  const { label, detail, badge, dot, shortcut } = words;
  if (!rail) return shortcut || dot ? label : undefined;

  const addsToTile = Boolean(shortcut || dot || detail || badge);
  return addsToTile ? [label, detail, badge ? `${badge}` : undefined].filter(Boolean).join(' · ') : undefined;
}
