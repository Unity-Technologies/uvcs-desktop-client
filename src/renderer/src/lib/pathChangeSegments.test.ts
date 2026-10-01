import { describe, expect, it } from 'vitest';
import { pathChangeSegments, type PathPart } from './pathChangeSegments';

const same = (text: string): PathPart => ({ text, changed: false });
const changed = (text: string): PathPart => ({ text, changed: true });

describe('pathChangeSegments', () => {
  it('says the shared folder once and marks the folders a move to a deeper folder added', () => {
    expect(
      pathChangeSegments(
        '/01plastic/nunit/nunitclient/merge/MatchMergeToFileConflictResolutionsTests.cs',
        '/01plastic/nunit/nunitclient/merge/mergeto/fileconflictsresolution/MatchMergeToFileConflictResolutionsTests.cs',
      ),
    ).toEqual({
      folder: '/01plastic/nunit/nunitclient/merge/',
      old: [same('MatchMergeToFileConflictResolutionsTests.cs')],
      new: [changed('mergeto/fileconflictsresolution/'), same('MatchMergeToFileConflictResolutionsTests.cs')],
    });
  });

  it('marks the folders a move to a parent folder removed', () => {
    expect(pathChangeSegments('src/merge/mergeto/X.cs', 'src/merge/X.cs')).toEqual({
      folder: 'src/merge/',
      old: [changed('mergeto/'), same('X.cs')],
      new: [same('X.cs')],
    });
  });

  it('marks the folder a move to a sibling folder left and the one it reached', () => {
    expect(pathChangeSegments('src/lib/Sibling.cs', 'src/app/Sibling.cs')).toEqual({
      folder: 'src/',
      old: [changed('lib/'), same('Sibling.cs')],
      new: [changed('app/'), same('Sibling.cs')],
    });
  });

  it('marks the whole name of a renamed file, however much of it stayed', () => {
    expect(pathChangeSegments('src/lib/Plie.cs', 'src/lib/Pliee.cs')).toEqual({
      folder: 'src/lib/',
      old: [changed('Plie.cs')],
      new: [changed('Pliee.cs')],
    });
  });

  it('tells a case-only rename', () => {
    expect(pathChangeSegments('docs/Readme.md', 'docs/README.md')).toEqual({ folder: 'docs/', old: [changed('Readme.md')], new: [changed('README.md')] });
  });

  it('marks everything after the shared folder of a move and rename', () => {
    expect(pathChangeSegments('src/lib/MovedAndRenamed.cs', 'src/app/NowElsewhere.cs')).toEqual({
      folder: 'src/',
      old: [changed('lib/MovedAndRenamed.cs')],
      new: [changed('app/NowElsewhere.cs')],
    });
  });

  it('shares no folder between paths that start apart, each shown whole', () => {
    expect(pathChangeSegments('TopLevel.cs', 'src/tools/TopLevel.cs')).toEqual({
      folder: '',
      old: [same('TopLevel.cs')],
      new: [changed('src/tools/'), same('TopLevel.cs')],
    });
    expect(pathChangeSegments('assets/a/b/c/Long.cs', 'tools/x/y/z/Long.cs')).toEqual({
      folder: '',
      old: [changed('assets/a/b/c/'), same('Long.cs')],
      new: [changed('tools/x/y/z/'), same('Long.cs')],
    });
  });

  it('shares no folder between rooted paths that share only the root', () => {
    expect(pathChangeSegments('/src/lib/Rooted.cs', '/Rooted.cs')).toEqual({ folder: '', old: [same('/'), changed('src/lib/'), same('Rooted.cs')], new: [same('/Rooted.cs')] });
    expect(pathChangeSegments('/src/a/X.cs', '/src/b/X.cs').folder).toBe('/src/');
  });

  it('marks a renamed root-level file whole', () => {
    expect(pathChangeSegments('old.ts', 'new.ts')).toEqual({ folder: '', old: [changed('old.ts')], new: [changed('new.ts')] });
  });

  it('keeps very long shared folders out of both lines', () => {
    const folder = `${'very-long-folder-name/'.repeat(12)}`;
    expect(pathChangeSegments(`${folder}a/File.cs`, `${folder}b/File.cs`)).toEqual({ folder, old: [changed('a/'), same('File.cs')], new: [changed('b/'), same('File.cs')] });
  });

  it('reads Windows separators, and either separator as the same', () => {
    expect(pathChangeSegments('C:\\wk\\src\\lib\\A.cs', 'C:\\wk\\src\\app\\A.cs')).toEqual({
      folder: 'C:\\wk\\src\\',
      old: [changed('lib\\'), same('A.cs')],
      new: [changed('app\\'), same('A.cs')],
    });
    expect(pathChangeSegments('src\\lib\\A.cs', 'src/lib/deeper/A.cs')).toEqual({ folder: 'src/lib/', old: [same('A.cs')], new: [changed('deeper/'), same('A.cs')] });
  });

  it('keeps Unicode names whole, an NFD name the same as its NFC spelling', () => {
    expect(pathChangeSegments('src/Ünïcødé/Größe.cs', 'src/Ünïcødé/Maße.cs')).toEqual({ folder: 'src/Ünïcødé/', old: [changed('Größe.cs')], new: [changed('Maße.cs')] });
    const nfd = 'src/Ünïcødé/'.normalize('NFD');
    expect(pathChangeSegments(`${nfd}Plié.cs`, 'src/Ünïcødé/deeper/Plié.cs')).toEqual({
      folder: 'src/Ünïcødé/',
      old: [same('Plié.cs')],
      new: [changed('deeper/'), same('Plié.cs')],
    });
  });

  it('changes nothing in identical paths', () => {
    expect(pathChangeSegments('src/app.ts', 'src/app.ts')).toEqual({ folder: 'src/', old: [same('app.ts')], new: [same('app.ts')] });
  });

  it('gives each path back when the folder and its parts are joined', () => {
    const { folder, old, new: now } = pathChangeSegments('/a/b/c/d.txt', '/a/x/c/y/d.txt');
    expect(folder + old.map((part) => part.text).join('')).toBe('/a/b/c/d.txt');
    expect(folder + now.map((part) => part.text).join('')).toBe('/a/x/c/y/d.txt');
  });
});
