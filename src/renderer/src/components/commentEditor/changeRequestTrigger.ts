import { Compartment, Facet, StateEffect, StateField, type EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import { isInCode } from './formatCommands';
import type { SuggestionQuery } from './suggestionTrigger';
import { lostFocus } from './typingAt';

/**
 * Whether the field offers the change requests a check-in applies (docs/features/rich-comments.md, "Suggestions"):
 * only a comment `cm` reads them in, a check-in's or a changeset's, where the window knows the branch whose reviews
 * hold them. A compartment of its own, as the branch can change while the field shows.
 */
export const changeRequestsOffered = Facet.define<boolean, boolean>({ combine: (values) => values.some(Boolean) });

export const changeRequestsOfferedCompartment = new Compartment();

export function withChangeRequestsOffered(offered: boolean): Extension {
  return changeRequestsOffered.of(offered);
}

/**
 * `[apply`, `cm`'s own syntax (`[apply-change:c0d1ce00]`), in any case, then as much of `-change:` as was typed and
 * what filters the requests: where a reference may start (after a space, a line's start, an opening bracket or an
 * emphasis mark), never inside a word. A Markdown link's `[` alone opens nothing.
 */
const TYPED_APPLY = /(?<![\p{L}\p{N}/@:.#\\-])\[apply(?:-(?:c(?:h(?:a(?:n(?:g(?:e:?)?)?)?)?)?)?)?([^\s\]]*)$/iu;

/** Where the list its button opened starts (`openChangeRequests`), while what's typed after it filters it. */
const openedAt = StateEffect.define<number>();

/**
 * Where the list opened by the change requests button starts, until the caret leaves what's typed after it, the text
 * changes other than by typing there, or the field loses the focus.
 */
export const changeRequestsOpened = StateField.define<number | null>({
  create: () => null,
  update: (at, transaction) => {
    for (const effect of transaction.effects) if (effect.is(openedAt)) return effect.value;
    if (at === null) return null;
    if (lostFocus(transaction)) return null;
    const typing = transaction.isUserEvent('input.type') || transaction.isUserEvent('delete.backward');
    if ((transaction.docChanged || transaction.selection) && !typing) return null;
    const moved = transaction.changes.mapPos(at, -1);
    return transaction.state.selection.main.head < moved ? null : moved;
  },
});

/**
 * What the change requests button does: opens their list at the caret, a space before it after a word (a reference
 * glued to a word reads, but badly), so what's typed next filters it and a pick writes the reference there.
 */
export function openChangeRequests(state: EditorState): TransactionSpec {
  const head = state.selection.main.head;
  const before = state.sliceDoc(head - 1, head);
  const space = before !== '' && !/\s/.test(before) ? ' ' : '';
  return {
    changes: { from: head, insert: space },
    selection: { anchor: head + space.length },
    effects: openedAt.of(head + space.length),
    scrollIntoView: true,
  };
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
  const at = state.field(changeRequestsOpened, false);
  if (at === null || at === undefined || !state.facet(changeRequestsOffered)) return null;
  const head = state.selection.main.head;
  const text = state.sliceDoc(at, head);
  if (/\s/.test(text)) return null;
  return { kind: 'changeRequest', from: at, to: head, text };
}
