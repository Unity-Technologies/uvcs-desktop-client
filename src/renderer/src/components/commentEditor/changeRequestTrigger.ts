import { Compartment, Facet, StateEffect, StateField, type EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import { isInCode } from './formatCommands';
import type { SuggestionQuery } from './suggestionTrigger';
import { lostFocus } from './typingAt';

/**
 * Whether the field offers the change requests a check-in applies (docs/features/rich-comments.md, "Suggestions"):
 * only a check-in's comment, where the window knows the branch whose reviews hold them (`ChangeRequestsContext`). A compartment of its own, as the branch can change while the field shows.
 */
export const changeRequestsOffered = Facet.define<boolean, boolean>({ combine: (values) => values.some(Boolean) });

export const changeRequestsOfferedCompartment = new Compartment();

export function withChangeRequestsOffered(offered: boolean): Extension {
  return changeRequestsOffered.of(offered);
}

/**
 * `[apply`, `cm`'s own syntax (`[apply-change:c0d1ce00]`), in any case, then as much of `-change:` as was typed, and
 * only after the whole `-change:` what filters the requests: where a reference may start (after a space, a line's start,
 * an opening bracket or an emphasis mark), never inside a word, and never a word that only starts like it (`[applying`).
 * A Markdown link's `[` alone opens nothing.
 */
const TYPED_APPLY = /(?<![\p{L}\p{N}/@:.#\\-])\[apply(?:-(?:c(?:h(?:a(?:n(?:g(?:e(?::([^\s\]]*))?)?)?)?)?)?)?)?$/iu;

/** Where the list its button opened starts, and what a pick writes before the reference there (a space after a word). */
interface Opened {
  at: number;
  prefix?: string;
}

const openedAt = StateEffect.define<Opened>();

/**
 * The list the change requests button opened (`openChangeRequests`), until the caret leaves what's typed after it, the
 * text changes other than by typing there, or the field loses the focus. It writes nothing itself: closed with no pick,
 * the text is as it was.
 */
export const changeRequestsOpened = StateField.define<Opened | null>({
  create: () => null,
  update: (opened, transaction) => {
    for (const effect of transaction.effects) if (effect.is(openedAt)) return effect.value;
    if (opened === null) return null;
    if (lostFocus(transaction)) return null;
    const typing = transaction.isUserEvent('input.type') || transaction.isUserEvent('delete.backward');
    if ((transaction.docChanged || transaction.selection) && !typing) return null;
    const at = transaction.changes.mapPos(opened.at, -1);
    return transaction.state.selection.main.head < at ? null : { ...opened, at };
  },
});

/**
 * What the change requests button does: opens their list at the caret, so what's typed next filters it and a pick
 * writes the reference there, a space before it after a word (a reference glued to a word reads, but badly).
 */
export function openChangeRequests(state: EditorState): TransactionSpec {
  const head = state.selection.main.head;
  const before = state.sliceDoc(head - 1, head);
  const prefix = before !== '' && !/\s/.test(before) ? ' ' : undefined;
  return { effects: openedAt.of({ at: head, ...(prefix && { prefix }) }), scrollIntoView: true };
}

/** The change requests' list for the caret, typed (`[apply`) or opened by its button; null where the field offers none. */
export function changeRequestQueryAt(state: EditorState): SuggestionQuery | null {
  if (!state.facet(changeRequestsOffered)) return null;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const match = TYPED_APPLY.exec(line.text.slice(0, head - line.from));
  if (!match) return null;
  const from = line.from + match.index;
  if (isInCode(state, from + 1)) return null;
  // The rest of a reference being edited, its closing bracket too: a pick replaces it whole.
  const rest = /^[^\s\]]*\]?/.exec(line.text.slice(head - line.from))![0];
  return { kind: 'changeRequest', from, to: head + rest.length, text: match[1] ?? '' };
}

/** The list its button opened, with what was typed since: none once a space is typed or the caret left the line. */
export function openedChangeRequestQuery(state: EditorState): SuggestionQuery | null {
  const opened = state.field(changeRequestsOpened, false);
  if (!opened || !state.facet(changeRequestsOffered)) return null;
  const head = state.selection.main.head;
  const text = state.sliceDoc(opened.at, head);
  if (/\s/.test(text)) return null;
  return { kind: 'changeRequest', from: opened.at, to: head, text, ...(opened.prefix && { prefix: opened.prefix }), byButton: true };
}

/** A line at the suggestion list's foot, its middle in code style. */
export interface SuggestionListHint {
  before: string;
  code: string;
  after: string;
}

/**
 * The change requests' list opened by their button teaches the way to write one by hand, `cm`'s own `[apply`; typed,
 * the user knows it already, and every other list says nothing.
 */
export function suggestionListHint(query: SuggestionQuery | null): SuggestionListHint | null {
  return query?.kind === 'changeRequest' && query.byButton ? { before: 'Type ', code: '[apply', after: ' in a comment to reference one' } : null;
}
