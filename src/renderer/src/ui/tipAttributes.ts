import type { PathMove, TipText } from './followTip';

/**
 * The attributes a tooltip is read from (`findTip`): `data-tip` its text, `data-tip-sub` the dimmed line under it,
 * `data-tip-shortcut` its keys, and `data-tip-move-from`/`-to` a moved item's two paths, shown one over the other with
 * what changed marked (`PathMoveLines`). A tip with a move needs no text of its own.
 */
export function readTipAttributes(attribute: (name: string) => string | null): TipText | null {
  const text = attribute('data-tip');
  const from = attribute('data-tip-move-from');
  const to = attribute('data-tip-move-to');
  const move = from !== null && to !== null ? { from, to } : undefined;
  if (text === null || (text === '' && !move)) return null;
  return { text, sub: attribute('data-tip-sub') ?? undefined, shortcut: attribute('data-tip-shortcut') ?? undefined, move };
}

/** The attributes that make an element's tooltip show a move, to spread on it beside its `data-tip`. */
export function moveTipAttributes(move: PathMove | undefined): Record<'data-tip-move-from' | 'data-tip-move-to', string | undefined> {
  return { 'data-tip-move-from': move?.from, 'data-tip-move-to': move?.to };
}
