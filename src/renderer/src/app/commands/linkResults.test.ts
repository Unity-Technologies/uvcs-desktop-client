import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { linkGroupIn } from './linkResults';

describe('linkGroupIn', () => {
  it('offers to open a pasted link, saying what it opens', () => {
    expect(linkGroupIn('plastic://acme.cloud/repos/game/changesets/12/diff')).toMatchObject({
      heading: 'Link',
      results: [{ id: 'link.open', label: 'Changeset 12', detail: 'game · acme · Cloud' }],
    });
    expect(linkGroupIn('cs:4207@game@local')?.results[0]).toMatchObject({ label: 'Changeset 4207', detail: 'game · This computer' });
  });

  it('leaves any other text to the search', () => {
    expect(linkGroupIn('Player')).toBeNull();
  });
});
