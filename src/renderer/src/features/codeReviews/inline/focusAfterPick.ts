import type { SegmentPick } from '../../../ui/segmentKeys';

/**
 * Whether a choice in a comment being written (its kind, or what on a model it's about) gives the focus back to the
 * comment's text, its caret where it was. A click does, so the writer goes on typing; keys don't, so ← and → go on
 * through the choices and Tab leads on from the switch, as in any radio group.
 */
export function returnsToFieldAfterPick(pick: SegmentPick): boolean {
  return pick === 'pointer';
}
