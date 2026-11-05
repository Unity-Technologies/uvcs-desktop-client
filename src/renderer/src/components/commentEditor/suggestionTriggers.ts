import { KIND_PREFIXES, type PrefixedKind } from '../../lib/kindPrefixes';

/** What a suggestion list offers: the objects a comment names, people and emoji. */
export type SuggestionKind = PrefixedKind | 'emoji';

/**
 * What opens each suggestion list as it's typed: the prefixes the palette reads too (`KIND_PREFIXES`: the specs'
 * prefixes and `@`), and the editor's own `:` for emoji. Apart from the editor, so focus mode's footer
 * (`focusModeHints`), drawn with the check-in, reads them without loading it.
 */
export const SUGGESTION_TRIGGERS: Readonly<Record<string, SuggestionKind>> = {
  ...KIND_PREFIXES,
  ':': 'emoji',
};

/**
 * Whether the word typed after a trigger names another repository's object (`cs:2@art`, `br:/main@art@host:8087`):
 * the suggestions list this repository's, so it gets no row and searches nothing here. A mention's `@` is an address.
 */
export function namesAnotherRepository(kind: SuggestionKind, typed: string): boolean {
  return kind !== 'person' && kind !== 'emoji' && typed.includes('@');
}
