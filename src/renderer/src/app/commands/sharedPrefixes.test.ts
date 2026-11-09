import { describe, expect, it } from 'vitest';
import { KIND_PREFIXES, type PrefixedKind } from '../../lib/kindPrefixes';
import { SUGGESTION_TRIGGERS } from '../../components/commentEditor/suggestionTriggers';
import { parseScope, SCOPE_PREFIXES, type SectionId } from './paletteScope';

/** The palette's section for each kind a shared prefix names: what a prefix means there. */
const PALETTE_SECTION: Record<PrefixedKind, SectionId> = {
  changeset: 'changesets',
  branch: 'branches',
  label: 'labels',
  shelve: 'shelves',
  codeReview: 'codeReviews',
  person: 'people',
};

/** The command palette and the comment editor speak one vocabulary (`KIND_PREFIXES`): a prefix means one kind in both. */
describe('the prefixes the palette and the comment editor share', () => {
  it.each(Object.entries(KIND_PREFIXES))('%s means %s in both', (prefix, kind) => {
    expect(SUGGESTION_TRIGGERS[prefix]).toBe(kind);
    expect(parseScope(prefix).scope).toBe(PALETTE_SECTION[kind]);
  });

  it('are what each surface adds its own prefixes to, never giving one of them another meaning', () => {
    const shared = Object.keys(KIND_PREFIXES);
    const paletteOwn = SCOPE_PREFIXES.map(({ prefix }) => prefix).filter((prefix) => !shared.includes(prefix));
    const editorOwn = Object.keys(SUGGESTION_TRIGGERS).filter((trigger) => !shared.includes(trigger));

    expect(paletteOwn).toEqual(['>', '/']);
    expect(editorOwn).toEqual([':', '#']);
    expect(parseScope(':tada').scope).toBe('all');
  });

  it('give `#` to the editor, for issues; the palette doesn’t read it', () => {
    expect(SUGGESTION_TRIGGERS['#']).toBe('issue');
    expect(parseScope('#12').scope).toBe('all');
  });
});
