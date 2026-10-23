import { describe, expect, it } from 'vitest';
import type { ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { emptyListWords, matchDialogWords, matchedMessage, pairingTag } from './moveMatchWords';

const change = (path: string, itemType: ItemType = 'file'): PendingChange => ({ path, kinds: ['locallyDeleted'], itemType, size: 0, lastModified: '' });

describe('the Search matches words', () => {
  it('asks where a deleted file went, offering new files', () => {
    expect(matchDialogWords(change('src/Player.cs'), 'deleted', true)).toEqual({
      title: 'Where did Player.cs go?',
      description: 'Pick the new file it became. Checked in, it becomes a move, and its history goes on.',
      placeholder: 'Find a new file',
      listLabel: 'New files',
      empty: 'No new files in Changes.',
      noMatches: 'No matching new files.',
      noneOfItsKind: 'No new files of its kind: a text file pairs with text files, a binary one with its extension.',
      noneThisAlike: 'No new files this alike. Lower the minimum to see more.',
      notMeasured: "Couldn't measure how alike they are.",
    });
  });

  it('asks where a new folder came from, offering deleted folders', () => {
    expect(matchDialogWords(change('art/heroes', 'directory'), 'new', true)).toMatchObject({
      title: 'Where did heroes come from?',
      placeholder: 'Find a deleted folder',
      empty: 'No deleted folders in Changes.',
    });
  });

  it('says where to show private files when Changes hides them, the only new items there are', () => {
    expect(matchDialogWords(change('a.cs'), 'deleted', false).empty).toBe('Changes hides private files: show them in Settings › Pending changes.');
    expect(matchDialogWords(change('a.cs'), 'new', false).empty).toBe('No deleted files in Changes.');
  });

  describe('the empty list', () => {
    const words = matchDialogWords(change('a.cs'), 'deleted', true);

    it('says nothing while it shows rows', () => {
      expect(emptyListWords(words, { search: '', shown: 3, pairable: 3 }, 3)).toBeNull();
    });

    it('says the search found nothing only while there is a search', () => {
      expect(emptyListWords(words, { search: 'hero', shown: 0, pairable: 3 }, 3)).toBe('No matching new files.');
      expect(emptyListWords(words, { search: '  ', shown: 0, pairable: undefined }, 0)).toBe('No new files in Changes.');
    });

    it("says when none is of its kind, which cm wouldn't pair", () => {
      expect(emptyListWords(words, { search: '', shown: 0, pairable: 0 }, 12)).toBe('No new files of its kind: a text file pairs with text files, a binary one with its extension.');
    });

    it('says when the minimum hides them all, and how to see them', () => {
      expect(emptyListWords(words, { search: '', shown: 0, pairable: 40 }, 40)).toBe('No new files this alike. Lower the minimum to see more.');
    });
  });

  it('names the move recorded', () => {
    expect(matchedMessage({ from: 'src/Player.cs', to: 'src/game/Hero.cs' })).toBe('Matched Player.cs with src/game/Hero.cs');
  });
});

describe('a candidate the detection paired', () => {
  it('says what with, and that a pick pairs it with the change instead', () => {
    expect(pairingTag(change('src/Rifle.cs'), { path: 'src/Old/Shotgun.cs', itemType: 'file', pairedWith: 'src/Gun.cs' })).toEqual({
      label: 'Paired with Gun.cs',
      tip: 'Changes found it moved with src/Gun.cs. Picking it pairs it with Rifle.cs instead.',
    });
  });

  it('says nothing for a candidate nothing paired', () => {
    expect(pairingTag(change('src/Rifle.cs'), { path: 'src/Weapon.cs', itemType: 'file' })).toBeNull();
  });
});
