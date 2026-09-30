/** What a sidebar entry says: what shows on it, and what only its tooltip tells. */
export interface NavItemWords {
  label: string;
  /** Quiet text beside the label, e.g. "Cloud". */
  detail?: string;
  /** A count, e.g. pending changes. */
  badge?: number;
  /** What waits there, shown as a dot; its words go under the tooltip's (`data-tip-sub`). */
  dot?: string;
  /** Shown beside the tooltip's words (`data-tip-shortcut`). */
  shortcut?: string;
}

/**
 * The tooltip's words for a sidebar entry, or none when they would only repeat what the entry shows. Wide, the label
 * shows, so the tooltip names the entry only to carry its shortcut or the dot's words; the rail shows icons only, so
 * the tooltip names every entry, with its detail and count.
 */
export function navItemTip(words: NavItemWords, rail: boolean): string | undefined {
  const { label, detail, badge, dot, shortcut } = words;
  if (!rail) return shortcut || dot ? label : undefined;
  return [label, detail, badge ? `${badge}` : undefined].filter(Boolean).join(' · ');
}
