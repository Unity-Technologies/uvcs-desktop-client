import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { pairDiffMetas } from './diffMetaPairs';
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

  it('keeps a folder added with its Unity meta and files in it, so the meta rides on the folder', () => {
    const entries = [folder('Assets/Props'), file('Assets/Props.meta'), file('Assets/Props/box.prefab'), file('Assets/Props/box.prefab.meta')];
    expect(paths(entries)).toEqual(['Assets/Props', 'Assets/Props.meta', 'Assets/Props/box.prefab', 'Assets/Props/box.prefab.meta']);
  });

  it("shows a folder added with its Unity meta as the folder's row, carrying the meta", () => {
    const pairs = pairDiffMetas(listedEntries([folder('Assets/Props'), file('Assets/Props.meta'), file('Assets/Props/box.prefab')]));
    expect(pairs.shown.map((entry) => [entry.path, entry.itemType, pairs.metaOf(entry)?.path])).toEqual([
      ['Assets/Props', 'directory', 'Assets/Props.meta'],
      ['Assets/Props/box.prefab', 'file', undefined],
    ]);
  });

  it('keeps a folder added with its meta inside another one added with its meta', () => {
    const entries = [folder('Assets/Props'), file('Assets/Props.meta'), folder('Assets/Props/Sub'), file('Assets/Props/Sub.meta'), file('Assets/Props/Sub/a.png')];
    expect(paths(entries)).toEqual(entries.map((entry) => entry.path));
  });

  it('keeps a folder deleted with its Unity meta and files in it', () => {
    expect(paths([folder('Assets/Old', 'deleted'), file('Assets/Old.meta', 'deleted'), file('Assets/Old/a.png', 'deleted')])).toEqual([
      'Assets/Old',
      'Assets/Old.meta',
      'Assets/Old/a.png',
    ]);
  });

  it('leaves out a folder added with files in it when its meta changed otherwise', () => {
    expect(paths([folder('Assets/Props'), file('Assets/Props.meta', 'changed'), file('Assets/Props/box.prefab')])).toEqual([
      'Assets/Props.meta',
      'Assets/Props/box.prefab',
    ]);
  });

  it('keeps a folder whose name only starts like another path', () => {
    expect(paths([folder('src'), file('src2/a.ts')])).toEqual(['src', 'src2/a.ts']);
  });
});
