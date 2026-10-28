import { EditorSelection, type TransactionSpec } from '@codemirror/state';

/** A chip's place in the text: a reference or an image. */
export interface ChipRange {
  from: number;
  to: number;
}

/** A click on a chip selects its text, which then shows as typed (`typedReference`), so typing replaces it. */
export function selectChip(chip: ChipRange): TransactionSpec {
  return { selection: EditorSelection.single(chip.from, chip.to), userEvent: 'select.pointer' };
}
