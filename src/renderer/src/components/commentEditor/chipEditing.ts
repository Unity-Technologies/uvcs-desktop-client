import { EditorSelection, type EditorState, type StateCommand, type TransactionSpec } from '@codemirror/state';
import { liveMarksOf } from './liveMarks';

/** A chip's place in the text: a reference or an image, which the editor draws as one piece. */
export interface ChipRange {
  from: number;
  to: number;
}

/** The chips on `pos`'s line, as the editor draws them while the caret isn't on them. */
export function chipsOnLine(state: EditorState, pos: number): ChipRange[] {
  const line = state.doc.lineAt(pos);
  return liveMarksOf(state, { revealsSelection: false }, [{ from: line.from, to: line.to }]).filter((mark) => mark.kind === 'reference' || mark.kind === 'image');
}

/**
 * Backspace right after a chip (`forward` false), or Delete right before one, takes the whole chip away, as Slack's
 * do: a chip is one piece, never left half typed. Anything else is the usual key's.
 */
export function deleteChip(forward: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const main = state.selection.main;
    if (!main.empty || state.selection.ranges.length > 1) return false;
    const chip = chipsOnLine(state, main.head).find((range) => (forward ? range.from : range.to) === main.head);
    if (!chip) return false;
    dispatch(state.update({ changes: { from: chip.from, to: chip.to }, scrollIntoView: true, userEvent: forward ? 'delete.forward' : 'delete.backward' }));
    return true;
  };
}

/** A click on a chip selects its text, which then shows as typed (`typedReference`), so typing replaces it. */
export function selectChip(chip: ChipRange): TransactionSpec {
  return { selection: EditorSelection.single(chip.from, chip.to), userEvent: 'select.pointer' };
}
