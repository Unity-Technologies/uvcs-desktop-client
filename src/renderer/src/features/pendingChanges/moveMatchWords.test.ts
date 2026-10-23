import { describe, expect, it } from 'vitest';
import type { ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { emptyListWords, matchDialogWords, matchedMessage } from './moveMatchWords';

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

  it('says the search found nothing only while there is a search', () => {
    const words = matchDialogWords(change('a.cs'), 'deleted', true);

    expect(emptyListWords(words, '')).toBe('No new files in Changes.');
    expect(emptyListWords(words, '  ')).toBe('No new files in Changes.');
    expect(emptyListWords(words, 'hero')).toBe('No matching new files.');
  });

  it('names the move recorded', () => {
    expect(matchedMessage({ from: 'src/Player.cs', to: 'src/game/Hero.cs' })).toBe('Matched Player.cs with src/game/Hero.cs');
  });
});
