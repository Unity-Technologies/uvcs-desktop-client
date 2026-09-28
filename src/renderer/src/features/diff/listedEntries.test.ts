import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { listedEntries } from './listedEntries';

const file = (path: string, status: DiffEntry['status'] = 'added'): DiffEntry => ({ status, path, itemType: 'file', baseRevisionId: -1, revisionId: 5, repository: 'game@local' });
const folder = (path: string, status: DiffEntry['status'] = 'added'): DiffEntry => ({ ...file(path, status), itemType: 'directory' });
const paths = (entries: DiffEntry[]) => listedEntries(entries).map((entry) => entry.path);

describe('listedEntries', () => {
  it('leaves out folders added with files in them, however deep', () => {
    const entries = [folder('Assets'), folder('Assets/Art'), folder('Assets/Art/Heroes'), file('Assets/Art/Heroes/hero.png'), file('src/app.ts', 'changed')];
    expect(paths(entries)).toEqual(['Assets/Art/Heroes/hero.png', 'src/app.ts']);
  });

  it('leaves out folders deleted with their files', () => {
    expect(paths([folder('old', 'deleted'), file('old/a.ts', 'deleted')])).toEqual(['old/a.ts']);
  });

  it('keeps an empty folder added, and a folder moved', () => {
    expect(paths([folder('empty'), folder('lib', 'moved'), file('lib/a.ts', 'changed')])).toEqual(['empty', 'lib', 'lib/a.ts']);
  });

  it('keeps a folder whose name only starts like another path', () => {
    expect(paths([folder('src'), file('src2/a.ts')])).toEqual(['src', 'src2/a.ts']);
  });
});
