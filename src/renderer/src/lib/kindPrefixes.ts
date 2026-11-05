/** The kinds of things a prefix names, wherever it's typed: the objects `cm` has specs for, and people. */
export type PrefixedKind = 'changeset' | 'branch' | 'label' | 'shelve' | 'codeReview' | 'person';

/**
 * The prefixes that name a kind of thing, one vocabulary for every place that reads them: the command palette, where
 * one narrows the search to that kind (`SCOPE_PREFIXES`), and the comment editor, where one opens its suggestions
 * (`SUGGESTION_TRIGGERS`). They are `cm`'s own object specs (`cs:12`, `br:/main`, `lb:v1`, `sh:3`), `cr:` written
 * like them for a code review (`cm` has no spec for one), and `@` for a person, as a mention writes them. Each place
 * adds its own beside them (the palette's `>` and `/`, the editor's `:`), never another meaning for one of these.
 * `#` is no one's: it's kept for issues. In the order both show them.
 */
export const KIND_PREFIXES: Readonly<Record<string, PrefixedKind>> = {
  'cs:': 'changeset',
  'br:': 'branch',
  'lb:': 'label',
  'sh:': 'shelve',
  'cr:': 'codeReview',
  '@': 'person',
};
