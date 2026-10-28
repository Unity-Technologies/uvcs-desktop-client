import { Transaction, type EditorState, type TransactionSpec } from '@codemirror/state';
import { changeToMatch } from './commentFieldText';
import { ownerChange } from './oneLine';
import { ownStep } from './ownStep';

/**
 * The change that makes the editor's text its owner's `value`, when the owner gave a text of its own. `sent`: the
 * texts the field sent its owner since they last agreed. A value among them is only the owner's echo of keys typed
 * since, late (keys typed fast, the owner's renders behind them), and is never written back: doing so took typed keys
 * away and put them back where the caret no longer was, scrambling the text. Any other value is the owner's: its
 * answer to the change just made (`sent` not empty: a summary handing a pasted line to its description), which stays
 * out of the history, so undo takes back the typing itself; or a text put in whole (a recent comment picked, a
 * changelist's comment, another workspace's draft), one step back to what was written before it.
 */
export function ownerSync(state: EditorState, value: string, sent: readonly string[]): TransactionSpec | null {
  if (sent.includes(value)) return null;
  const change = changeToMatch(state.doc.toString(), value);
  if (!change) return null;
  return { changes: change, annotations: [ownerChange.of(true), sent.length > 0 ? Transaction.addToHistory.of(false) : ownStep] };
}
