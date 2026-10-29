/** What a suggestion list offers: the objects a comment names, people and emoji. */
export type SuggestionKind = 'changeset' | 'branch' | 'label' | 'shelve' | 'codeReview' | 'person' | 'emoji';

/**
 * What opens each suggestion list as it's typed: the specs' prefixes, `@` and `:`. Apart from the editor, so focus
 * mode's footer (`focusModeHints`), drawn with the check-in, reads them without loading it.
 */
export const SUGGESTION_TRIGGERS: Readonly<Record<string, SuggestionKind>> = {
  'cs:': 'changeset',
  'br:': 'branch',
  'lb:': 'label',
  'sh:': 'shelve',
  'cr:': 'codeReview',
  '@': 'person',
  ':': 'emoji',
};

/**
 * Whether the word typed after a trigger names another repository's object (`cs:2@art`, `br:/main@art@host:8087`):
 * the suggestions list this repository's, so it gets no row and searches nothing here. A mention's `@` is an address.
 */
export function namesAnotherRepository(kind: SuggestionKind, typed: string): boolean {
  return kind !== 'person' && kind !== 'emoji' && typed.includes('@');
}
