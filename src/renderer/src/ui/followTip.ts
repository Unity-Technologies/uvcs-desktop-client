/** Where a moved item was and where it is now. */
export interface PathMove {
  from: string;
  to: string;
}

/** What a tooltip says: its text, the dimmed second line, the shortcut's keys and a moved item's two paths. */
export interface TipText {
  text: string;
  sub?: string;
  shortcut?: string;
  move?: PathMove;
}

/**
 * The tooltip on screen once what it points at changed under the still pointer: the element's new words (a switch
 * moved the changeset it names), or none once it went away or stopped having a tip. Unchanged words keep it as it is.
 */
export function followTip<Shown extends TipText>(shown: Shown, now: TipText | null): Shown | null {
  if (!now) return null;
  if (now.text === shown.text && now.sub === shown.sub && now.shortcut === shown.shortcut && sameMove(now.move, shown.move)) return shown;
  return { ...shown, text: now.text, sub: now.sub, shortcut: now.shortcut, move: now.move };
}

function sameMove(a: PathMove | undefined, b: PathMove | undefined): boolean {
  return a?.from === b?.from && a?.to === b?.to;
}
