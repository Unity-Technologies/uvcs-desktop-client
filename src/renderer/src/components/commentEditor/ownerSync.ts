import { Transaction, type EditorState, type TransactionSpec } from '@codemirror/state';
import { changeToMatch } from './commentFieldText';
import { ownerChange } from './oneLine';
import { ownStep } from './ownStep';

/** What the field knows of its exchange with its owner when it compares their texts. */
export interface OwnerExchange {
  /** The texts the field sent its owner since they last agreed. */
  sent: readonly string[];
  /** The text the render that brought `value` showed: keys typed since are newer than that render. */
  rendered: string;
}

/**
 * The change that makes the editor's text its owner's `value`, when the owner gave a text of its own. The owner's
 * value is only late, and never written back, when it is the text its render showed (keys typed between that render
 * and its effect are newer) or one the field sent (keys typed fast, the owner's renders behind them): writing it back
 * took typed keys away and put them back where the caret no longer was, scrambling the text. Any other value is the
 * owner's: its answer to the change just made (`sent` not empty: a summary handing a pasted line to its description),
 * which stays out of the history, so undo takes back the typing itself; or a text put in whole (a recent comment
 * picked, a changelist's comment, another workspace's draft), one step back to what was written before it.
 */
export function ownerSync(state: EditorState, value: string, { sent, rendered }: OwnerExchange): TransactionSpec | null {
  if (value === rendered || sent.includes(value)) return null;
  const change = changeToMatch(state.doc.toString(), value);
  if (!change) return null;
  return { changes: change, annotations: [ownerChange.of(true), sent.length > 0 ? Transaction.addToHistory.of(false) : ownStep] };
}
