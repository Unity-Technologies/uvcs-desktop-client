/** What a tooltip says: its text, the dimmed second line and the shortcut's keys. */
export interface TipText {
  text: string;
  sub?: string;
  shortcut?: string;
}

/**
 * The tooltip on screen once what it points at changed under the still pointer: the element's new words (a switch
 * moved the changeset it names), or none once it went away or stopped having a tip. Unchanged words keep it as it is.
 */
export function followTip<Shown extends TipText>(shown: Shown, now: TipText | null): Shown | null {
  if (!now) return null;
  if (now.text === shown.text && now.sub === shown.sub && now.shortcut === shown.shortcut) return shown;
  return { ...shown, text: now.text, sub: now.sub, shortcut: now.shortcut };
}
