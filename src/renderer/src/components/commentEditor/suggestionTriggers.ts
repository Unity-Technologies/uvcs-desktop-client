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
