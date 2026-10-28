import { Annotation, EditorState, Transaction, type ChangeSpec, type Extension } from '@codemirror/state';
import { oneLineText } from './commentFieldText';

/** A change the field's owner made (its `value`), which isn't the user's typing to hand back. */
export const ownerChange = Annotation.define<boolean>();

/**
 * A one-line field (a summary, a title) holds no line end the user types or drops (Shift+Enter, a drop of several
 * lines): each turns into a space, as an `<input>` takes it. A paste keeps its lines for the field's owner to place
 * (a summary goes on in its description, `withSummaryText`; a title joins them, `oneLineText`), and so does the owner.
 */
export const oneLine: Extension = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged || transaction.isUserEvent('input.paste') || transaction.annotation(ownerChange)) return transaction;
  let breaks = false;
  transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    if (inserted.lines > 1) breaks = true;
  });
  if (!breaks) return transaction;
  const changes: ChangeSpec[] = [];
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => changes.push({ from: fromA, to: toA, insert: oneLineText(inserted.toString()) }));
  const set = transaction.startState.changes(changes);
  const userEvent = transaction.annotation(Transaction.userEvent);
  return { changes: set, selection: transaction.startState.selection.map(set, 1), scrollIntoView: true, ...(userEvent && { userEvent }) };
});
