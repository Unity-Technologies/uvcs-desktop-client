import type { EditorState, TransactionSpec } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { changeRequestQueryAt, openedChangeRequestQuery } from './changeRequestTrigger';
import { EMOTICON_EMOJI } from './emoticons';
import { isInCode } from './formatCommands';
import { issueReferences } from './issueReferencesFacet';
import { suggestionPicked } from './justPicked';
import { ownStep } from './ownStep';
import { SUGGESTION_TRIGGERS, type SuggestionKind } from './suggestionTriggers';
import { typingAt } from './typingAt';

/** What is being typed at the caret that a suggestion list completes. */
export interface SuggestionQuery {
  kind: SuggestionKind;
  /** Where the trigger (`cs:`, `@`, `:`) starts: what a pick replaces from, and where the list opens. */
  from: number;
  /** Where the word being typed ends, past the caret when it's in the middle: what a pick replaces to. */
  to: number;
  /** What was typed after the trigger, up to the caret. */
  text: string;
  /** What a pick writes before the reference: a space, where the change requests button opened the list after a word. */
  prefix?: string;
}

/**
 * A trigger where a reference may start (`findReferences`): after a space, a line's start, an opening bracket or an
 * emphasis mark, never inside a word, a path or an address (`ana@acme.com`, `/a/cs:1`, `10:30`, `Note:`), then the
 * word typed so far.
 */
const TYPED = new RegExp(`(?<![\\p{L}\\p{N}/@:.#\\\\-])(${triggerAlternatives()})(\\S*)$`, 'u');

/** The triggers as a pattern's alternatives, longest first, so `cs:` is taken whole before the emoji's `:` could be. */
function triggerAlternatives(): string {
  const triggers = Object.keys(SUGGESTION_TRIGGERS).sort((a, b) => b.length - a.length);
  return triggers.map((trigger) => trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

/** An emoji's name as typed: GitHub's list opens after two letters, so a colon in a sentence opens nothing. */
const EMOJI_NAME = /^[a-z0-9_+-]{2,}$/;

/**
 * What may follow `#` for an issue: a key, a number or a word of its title, with the title's own marks
 * (`[Desktop]`, `(crash)`), which the search drops. Never another `#` (`##` is a heading's start); a space after `#`
 * (`# Title`) ends the word before it starts, so a heading opens nothing.
 */
const ISSUE_TEXT = /^(?!#)\S*$/u;

/** What a person's name may hold as typed, as `cm` names owners (`DOMAIN\name`, an email address). */
const PERSON_NAME = /^[\p{L}\p{N}_.+\\@-]*$/u;

/** The suggestion list to show for the caret, or null for none: a selection, code, or no trigger before the caret. */
export function suggestionQueryAt(state: EditorState): SuggestionQuery | null {
  const main = state.selection.main;
  if (!main.empty || state.selection.ranges.length > 1) return null;
  // `[apply`, where the field offers change requests to apply: `cm`'s own syntax, apart from the prefixes.
  const changeRequest = changeRequestQueryAt(state);
  if (changeRequest) return changeRequest;
  const line = state.doc.lineAt(main.head);
  const match = TYPED.exec(line.text.slice(0, main.head - line.from));
  if (!match) return null;
  const [, trigger = '', text = ''] = match;
  const kind = SUGGESTION_TRIGGERS[trigger]!;
  // An emoticon (`:-p`) opens no list: its Enter would pick an emoji named like it, not turn it into its own (`emoticonTyping`).
  if (kind === 'emoji' && (!EMOJI_NAME.test(text) || Object.hasOwn(EMOTICON_EMOJI, `:${text}`))) return null;
  if (kind === 'person' && !PERSON_NAME.test(text)) return null;
  // `#` is plain text where the place has no tracker: no list, no hint.
  if (kind === 'issue' && (!ISSUE_TEXT.test(text) || !state.facet(issueReferences))) return null;
  const from = line.from + match.index;
  if (isInCode(state, from + 1) || isInAddress(state, from + 1)) return null;
  // A sentence's punctuation after the word stays: it's no part of a name (`TRAILING_PUNCTUATION`).
  const rest = /^\S*/.exec(line.text.slice(main.head - line.from))![0].replace(/[.,;:!?)\]}'"*_~]+$/, '');
  return { kind, from, to: main.head + rest.length, text };
}

/**
 * The suggestion list to show: the word at the caret's (`suggestionQueryAt`), only while it is being typed
 * (`typingAt`), or the change requests their button opened (`openedChangeRequestQuery`). A field that opens with its
 * caret after a reference, or a caret moved into one, opens none.
 */
export function suggestionsShownAt(state: EditorState): SuggestionQuery | null {
  const typed = state.field(typingAt, false) === state.selection.main.head ? suggestionQueryAt(state) : null;
  return typed ?? openedChangeRequestQuery(state);
}

/**
 * The suggestion list's query, or null for none (docs/features/rich-comments.md, "Suggestions"): the word typed at the
 * caret (`suggestionsShownAt`), in a field with the focus (`editorFocused`: the DOM's), unless Esc closed the list on
 * that word (`dismissedAt`: where it started).
 */
export function suggestionGate(state: EditorState, focused: boolean, dismissedAt: number | null): SuggestionQuery | null {
  if (!focused) return null;
  const query = suggestionsShownAt(state);
  return query && !isDismissed(query, dismissedAt) ? query : null;
}

/** Whether Esc closed the list on this word (`dismissedAt`: where it started): it opens again for another one. */
export function isDismissed(query: SuggestionQuery, dismissedAt: number | null): boolean {
  return dismissedAt !== null && query.from === dismissedAt;
}

/**
 * What picking a suggestion does: the word typed becomes `insert` and a space, the caret after it to go on writing.
 * A space already there is stepped over, not doubled; a sentence's punctuation after the word stays right after it,
 * and a line's end too (no space left at it): the reference stays drawn there all the same (`justPicked`). One step
 * to undo.
 */
export function pickSuggestion(state: EditorState, query: SuggestionQuery, insert: string): TransactionSpec {
  const next = state.sliceDoc(query.to, query.to + 1);
  const space = next === '' || !/[\s.,;:!?)\]}'"*_~]/.test(next) ? ' ' : '';
  const from = query.from + (query.prefix?.length ?? 0);
  return {
    changes: { from: query.from, to: query.to, insert: (query.prefix ?? '') + insert + space },
    selection: { anchor: from + insert.length + (space || next === ' ' ? 1 : 0) },
    effects: suggestionPicked.of({ from, to: from + insert.length }),
    scrollIntoView: true,
    userEvent: 'input.complete',
    annotations: ownStep,
  };
}

/** Inside a web address (`https://ci.acme.com/job?b=br:`) or a link's, where a reference is never read. */
function isInAddress(state: EditorState, pos: number): boolean {
  for (let node = syntaxTree(state).resolveInner(pos, -1); node.parent; node = node.parent) {
    if (node.name === 'URL' && /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/i.test(state.sliceDoc(node.from, node.to))) return true;
  }
  return false;
}
