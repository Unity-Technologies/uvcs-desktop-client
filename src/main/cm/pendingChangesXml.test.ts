import { describe, expect, it } from 'vitest';
import { countCharactersRead } from '@shared/testing/countCharactersRead';
import { parsePendingChanges } from './pendingChangesXml';
import { change } from './testing/cmOutput';

const header = '<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>7</Changeset></Status></WorkspaceStatus>';

describe('parsePendingChanges', () => {
  it('reads plain status output and merges entries of the same item', () => {
    const xml = `${header}<Changes>${change('CH', 'src/b.ts')}${change('MV', 'src/b.ts', { oldPath: 'src/a.ts' })}${change('PR', 'new.txt')}</Changes></StatusOutput>`;
    const snapshot = parsePendingChanges(xml);

    expect(snapshot.changelists).toEqual([]);
    expect(snapshot.changes).toHaveLength(2);
    expect(snapshot.changes[0]).toMatchObject({ path: 'src/b.ts', oldPath: 'src/a.ts', kinds: ['changed', 'moved'] });
    // Nothing empty goes over IPC for each of tens of thousands of changes.
    expect(Object.keys(snapshot.changes[1]!)).toEqual(['path', 'kinds', 'itemType', 'size', 'lastModified']);
  });

  it('lists the merges the changes come from, each once', () => {
    const merged = (path: string, info: string): string => change('CO+CH', path, { merge: ` (${info})` });
    const xml = `${header}<Changes>${merged('a.ts', 'Merge from 242')}${merged('b.ts', 'Merge from 242')}${change('CH', 'c.ts')}</Changes></StatusOutput>`;
    const snapshot = parsePendingChanges(xml);

    expect(snapshot.changes[0]!.mergeInfo).toBe('Merge from 242');
    expect(snapshot.mergeLinks).toEqual([{ type: 'merge', sourceChangeset: 242 }]);
    expect(parsePendingChanges(`${header}<Changes>${change('CH', 'c.ts')}</Changes></StatusOutput>`).mergeLinks).toEqual([]);
  });

  it('leaves out the minimum date cm reports for moved items', () => {
    const moved = change('MV', 'docs/a.ts', { oldPath: 'src/a.ts', lastModified: '0001-01-01T00:00:00' });
    expect(parsePendingChanges(`${header}<Changes>${moved}</Changes></StatusOutput>`).changes[0]!.lastModified).toBe('');
  });

  it('reads the backslashes cm writes on Windows as forward slashes, and keeps them in names elsewhere', () => {
    const moved = change('MV', 'src\\ui\\b.ts', { oldPath: 'src\\a.ts' });
    const xml = `${header}<Changes>${moved}</Changes></StatusOutput>`;

    expect(parsePendingChanges(xml, 'win32').changes[0]).toMatchObject({ path: 'src/ui/b.ts', oldPath: 'src/a.ts' });
    expect(parsePendingChanges(xml, 'linux').changes[0]).toMatchObject({ path: 'src\\ui\\b.ts', oldPath: 'src\\a.ts' });
  });

  it('assigns changes to their changelists', () => {
    const xml = `${header}<Changelists>
      <Changelist><Name>Default</Name><Description>Default</Description><Changes>${change('PR', 'a.txt')}</Changes></Changelist>
      <Changelist><Name>UI work</Name><Description>polish</Description><Changes>${change('CO+CH', 'b.txt')}</Changes></Changelist>
    </Changelists></StatusOutput>`;
    const snapshot = parsePendingChanges(xml);

    expect(snapshot.changelists).toEqual([{ name: 'UI work', description: 'polish' }]);
    expect(snapshot.changes.map((item) => [item.path, item.changelist, item.kinds])).toEqual([
      ['a.txt', undefined, ['private']],
      ['b.txt', 'UI work', ['checkedOut', 'changed']],
    ]);
  });

  it('reads the output of cm on Windows: CRLF line breaks and backslashes in paths', () => {
    const moved = change('MV', 'Assets\\Scripts\\b.cs', { oldPath: 'Assets\\a.cs' });
    const xml = `${header}\r\n<Changes>\r\n${moved}\r\n${change('PR', 'Assets\\new file.txt')}\r\n</Changes>\r\n</StatusOutput>\r\n`;
    expect(parsePendingChanges(xml, 'win32').changes.map((item) => [item.path, item.oldPath])).toEqual([
      ['Assets/Scripts/b.cs', 'Assets/a.cs'],
      ['Assets/new file.txt', undefined],
    ]);
    // Elsewhere a backslash is part of a name.
    expect(parsePendingChanges(xml, 'linux').changes[1]!.path).toBe('Assets\\new file.txt');
  });

  it('reads thousands of pending changes in one pass: a few reads of each character, whatever the size', () => {
    const changes = Array.from({ length: 5_000 }, (_, index) => change(index % 3 ? 'CH' : 'PR', `src/folder${index % 100}/file_${index}.ts`)).join('\n');
    const xml = `${header}<Changelists><Changelist><Name>Default</Name><Changes>${changes}</Changes></Changelist></Changelists></StatusOutput>`;
    const { result: snapshot, charactersRead } = countCharactersRead(() => parsePendingChanges(xml));
    // About 3.7 reads of each character; a pass over the rest of the output per change reads each thousands of times.
    expect(charactersRead / xml.length).toBeLessThan(6);
    expect(snapshot.changes).toHaveLength(5_000);
  });
});

