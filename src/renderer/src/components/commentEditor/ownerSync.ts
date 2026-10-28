import { Transaction, type EditorState, type TransactionSpec } from '@codemirror/state';
import { changeToMatch } from './commentFieldText';
import { ownerChange } from './oneLine';
import { ownStep } from './ownStep';

/**
 * The change that makes the editor's text its owner's `value`, when they differ. `answersTyping`: the owner only
 * answered the change just made (a summary handing a pasted line to its description), which stays out of the
 * history, so undo takes back the typing itself. Otherwise the owner put a text in whole (a recent comment picked, a
 * changelist's comment, another workspace's draft), and undo is one step back to what was written before it.
 */
export function ownerSync(state: EditorState, value: string, answersTyping: boolean): TransactionSpec | null {
  const change = changeToMatch(state.doc.toString(), value);
  if (!change) return null;
  return { changes: change, annotations: [ownerChange.of(true), answersTyping ? Transaction.addToHistory.of(false) : ownStep] };
}
