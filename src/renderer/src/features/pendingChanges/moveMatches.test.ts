import { describe, expect, it } from 'vitest';
import type { ChangeKind, ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { compareCandidates, matchCandidates, matchSideOf, moveMatchOf, searchedCandidates } from './moveMatches';

const change = (path: string, kinds: ChangeKind[], itemType: ItemType = 'file'): PendingChange => ({ path, kinds, itemType, size: 0, lastModified: '' });
const deleted = (path: string, itemType?: ItemType) => change(path, ['locallyDeleted'], itemType);
const added = (path: string, itemType?: ItemType) => change(path, ['private'], itemType);
const paths = (changes: PendingChange[]) => changes.map((each) => each.path);

describe('which changes can be matched', () => {
  it('offers an item deleted from disk and a private one, files and folders alike', () => {
    expect(matchSideOf(deleted('src/Player.cs'), [])).toBe('deleted');
    expect(matchSideOf(deleted('art', 'directory'), [])).toBe('deleted');
    expect(matchSideOf(added('src/Hero.cs'), [])).toBe('new');
    expect(matchSideOf(added('tex/hero.png', 'binaryFile'), [])).toBe('new');
  });

  it('offers no other change: a delete with cm, a move already paired, an added, changed or ignored item', () => {
    for (const kinds of [['deleted'], ['locallyDeleted', 'moved'], ['locallyMoved'], ['added'], ['changed'], ['ignored'], ['cloaked']] as ChangeKind[][]) {
      expect(matchSideOf(change('src/a.cs', kinds), [])).toBeNull();
    }
  });

  it('offers no link or xlink: cm moves them by other rules', () => {
    expect(matchSideOf(added('bin/tool', 'symlink'), [])).toBeNull();
    expect(matchSideOf(deleted('lib', 'xlink'), [])).toBeNull();
  });

  it("offers no private item inside a private folder: cm can't move onto it", () => {
    const changes = [added('new', 'directory'), added('new/deep/Hero.cs')];

    expect(matchSideOf(changes[1]!, changes)).toBeNull();
    expect(matchSideOf(changes[0]!, changes)).toBe('new');
  });
});

describe('the candidates', () => {
  it('offers the other side only, of the same type: files with files, folders with folders', () => {
    const player = deleted('src/Player.cs');
    const changes = [player, deleted('src/Enemy.cs'), added('src/Hero.cs'), added('tex/hero.png'), added('src/heroes', 'directory'), change('src/Map.cs', ['changed'])];

    expect(paths(matchCandidates(player, changes))).toEqual(['src/Hero.cs', 'tex/hero.png']);
    expect(paths(matchCandidates(changes[4]!, [...changes, deleted('src/people', 'directory')]))).toEqual(['src/people']);
  });

  it('offers deleted items for a new one', () => {
    const hero = added('src/Hero.cs');

    expect(paths(matchCandidates(hero, [hero, added('src/Other.cs'), deleted('src/Player.cs')]))).toEqual(['src/Player.cs']);
  });

  it('leaves out the new items inside a new folder', () => {
    const player = deleted('src/Player.cs');

    expect(paths(matchCandidates(player, [player, added('new', 'directory'), added('new/Player.cs'), added('src/Hero.cs')]))).toEqual(['src/Hero.cs']);
  });

  it('offers none for a change that takes no side', () => {
    expect(matchCandidates(change('src/a.cs', ['changed']), [added('src/b.cs')])).toEqual([]);
  });
});

describe('the likeliest candidate first', () => {
  const ranked = (path: string, candidates: string[]) => [...candidates].sort((a, b) => compareCandidates(path, a, b));

  it('puts the same name first (a move), then the same extension (a rename), then the rest', () => {
    expect(ranked('src/Player.cs', ['docs/notes.txt', 'src/Hero.cs', 'game/player.CS'])).toEqual(['game/player.CS', 'src/Hero.cs', 'docs/notes.txt']);
  });

  it('puts the closest folder first among alike names, then path order', () => {
    expect(ranked('src/game/Player.cs', ['tools/Player.cs', 'src/game/ai/deep/Player.cs', 'src/Player.cs', 'src/game/ai/Player.cs'])).toEqual([
      'src/game/ai/Player.cs',
      'src/game/ai/deep/Player.cs',
      'src/Player.cs',
      'tools/Player.cs',
    ]);
    expect(ranked('a.cs', ['b10.cs', 'b2.cs'])).toEqual(['b2.cs', 'b10.cs']);
  });

  it('takes names with no extension as unlike one another but for their name', () => {
    expect(ranked('Makefile', ['README', 'build/Makefile'])).toEqual(['build/Makefile', 'README']);
  });
});

describe('the search', () => {
  it('keeps the candidates holding every word typed in their path, in their order', () => {
    const candidates = [added('src/game/Hero.cs'), added('src/HeroTests.cs'), added('docs/hero.md')];

    expect(paths([...searchedCandidates(candidates, 'hero src')])).toEqual(['src/game/Hero.cs', 'src/HeroTests.cs']);
    expect(searchedCandidates(candidates, ' ')).toBe(candidates);
  });
});

describe('the move recorded', () => {
  it('goes from the deleted item to the new one, whichever side the menu was opened on', () => {
    expect(moveMatchOf(deleted('a.cs'), added('b.cs'), 'deleted')).toEqual({ from: 'a.cs', to: 'b.cs' });
    expect(moveMatchOf(added('b.cs'), deleted('a.cs'), 'new')).toEqual({ from: 'a.cs', to: 'b.cs' });
  });
});
