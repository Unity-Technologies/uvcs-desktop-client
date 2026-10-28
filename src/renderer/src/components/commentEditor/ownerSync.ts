import { Transaction, type EditorState, type TransactionSpec } from '@codemirror/state';
import { changeToMatch } from './commentFieldText';
import { ownerChange } from './oneLine';
import { ownStep } from './ownStep';

/** A field's exchange with its owner: the texts it sends, the values the owner gives back. */
export interface OwnerExchange {
  /** The field sent its owner a text the user typed (or pasted, cut, dropped). */
  typed: () => void;
  /**
   * After a render: the change that makes the editor's text (`live`) its owner's `value`, or null when there's none to
   * make. `rendered` is the state that render showed (null before the first), which the view may since have passed.
   */
  synced: (live: EditorState, rendered: EditorState | null, value: string) => TransactionSpec | null;
}

/**
 * How a field follows its owner's value (docs/features/rich-comments.md, "Writing"). React renders the field's state
 * and its owner's value together (the update listener's `setState` and the owner's store batched in one render), so a
 * value equal to the text its render showed is the owner agreeing, whatever keys landed since, between that render and
 * its effect: writing it back took those keys away and put them back where the caret no longer was. Any other value is
 * the owner's own: its answer to text just sent (a summary handing a pasted line to its description), kept out of the
 * history so undo takes back the typing itself; or a text put in whole with nothing waiting for an answer (a recent
 * comment picked, a changelist's comment, another workspace's draft), one step back to what was written before it.
 * Telling an echo by matching the texts sent was dropped: an owner's answer can equal a text sent a moment before.
 */
export function ownerExchange(): OwnerExchange {
  let awaitingAnswer = false;
  return {
    typed: () => {
      awaitingAnswer = true;
    },
    synced: (live, rendered, value) => {
      const shown = (rendered ?? live).doc.toString();
      const change = value === shown ? null : changeToMatch(live.doc.toString(), value);
      if (!change) {
        if (live.doc.toString() === value) awaitingAnswer = false;
        return null;
      }
      const answer = awaitingAnswer;
      awaitingAnswer = false;
      return { changes: change, annotations: [ownerChange.of(true), answer ? Transaction.addToHistory.of(false) : ownStep] };
    },
  };
}
