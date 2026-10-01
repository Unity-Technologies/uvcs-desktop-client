import { describe, expect, it } from 'vitest';
import { pathChangeSegments, type PathPart } from './pathChangeSegments';

const same = (text: string): PathPart => ({ text, changed: false });
const changed = (text: string): PathPart => ({ text, changed: true });

describe('pathChangeSegments', () => {
  it('marks the folders a move to a deeper folder added', () => {
    expect(
      pathChangeSegments(
        '/01plastic/nunit/nunitclient/merge/MatchMergeToFileConflictResolutionsTests.cs',
        '/01plastic/nunit/nunitclient/merge/mergeto/fileconflictsresolution/MatchMergeToFileConflictResolutionsTests.cs',
      ),
    ).toEqual({
      old: [same('/01plastic/nunit/nunitclient/merge/MatchMergeToFileConflictResolutionsTests.cs')],
      new: [same('/01plastic/nunit/nunitclient/merge/'), changed('mergeto/fileconflictsresolution/'), same('MatchMergeToFileConflictResolutionsTests.cs')],
    });
  });

  it('marks the folders a move to a shallower folder removed', () => {
    expect(pathChangeSegments('src/merge/mergeto/X.cs', 'src/merge/X.cs')).toEqual({
      old: [same('src/merge/'), changed('mergeto/'), same('X.cs')],
      new: [same('src/merge/X.cs')],
    });
  });

  it('marks the folder a move to a sibling folder left and the one it reached', () => {
    expect(pathChangeSegments('src/lib/Sibling.cs', 'src/app/Sibling.cs')).toEqual({
      old: [same('src/'), changed('lib/'), same('Sibling.cs')],
      new: [same('src/'), changed('app/'), same('Sibling.cs')],
    });
  });

  it('marks the whole name of a renamed file, however much of it stayed', () => {
    expect(pathChangeSegments('src/lib/Plie.cs', 'src/lib/Pliee.cs')).toEqual({
      old: [same('src/lib/'), changed('Plie.cs')],
      new: [same('src/lib/'), changed('Pliee.cs')],
    });
  });

  it('tells a case-only rename', () => {
    expect(pathChangeSegments('docs/Readme.md', 'docs/README.md')).toEqual({
      old: [same('docs/'), changed('Readme.md')],
      new: [same('docs/'), changed('README.md')],
    });
  });

  it('marks everything after the common folders of a move and rename', () => {
    expect(pathChangeSegments('src/lib/MovedAndRenamed.cs', 'src/app/NowElsewhere.cs')).toEqual({
      old: [same('src/'), changed('lib/MovedAndRenamed.cs')],
      new: [same('src/'), changed('app/NowElsewhere.cs')],
    });
  });

  it('marks the folders of a file moved out of the root or into it', () => {
    expect(pathChangeSegments('TopLevel.cs', 'src/tools/TopLevel.cs')).toEqual({
      old: [same('TopLevel.cs')],
      new: [changed('src/tools/'), same('TopLevel.cs')],
    });
    expect(pathChangeSegments('/src/lib/Rooted.cs', '/Rooted.cs')).toEqual({
      old: [same('/'), changed('src/lib/'), same('Rooted.cs')],
      new: [same('/Rooted.cs')],
    });
  });

  it('marks a renamed root-level file whole', () => {
    expect(pathChangeSegments('old.ts', 'new.ts')).toEqual({ old: [changed('old.ts')], new: [changed('new.ts')] });
  });

  it('reads Windows separators, and either separator as the same', () => {
    expect(pathChangeSegments('C:\\wk\\src\\lib\\A.cs', 'C:\\wk\\src\\app\\A.cs')).toEqual({
      old: [same('C:\\wk\\src\\'), changed('lib\\'), same('A.cs')],
      new: [same('C:\\wk\\src\\'), changed('app\\'), same('A.cs')],
    });
    expect(pathChangeSegments('src\\lib\\A.cs', 'src/lib/deeper/A.cs')).toEqual({
      old: [same('src\\lib\\A.cs')],
      new: [same('src/lib/'), changed('deeper/'), same('A.cs')],
    });
  });

  it('keeps Unicode names whole, an NFD name the same as its NFC spelling', () => {
    expect(pathChangeSegments('src/Ünïcødé/Größe.cs', 'src/Ünïcødé/Maße.cs')).toEqual({
      old: [same('src/Ünïcødé/'), changed('Größe.cs')],
      new: [same('src/Ünïcødé/'), changed('Maße.cs')],
    });
    const nfd = 'src/Ünïcødé/'.normalize('NFD');
    expect(pathChangeSegments(`${nfd}Plié.cs`, 'src/Ünïcødé/deeper/Plié.cs')).toEqual({
      old: [same(`${nfd}Plié.cs`)],
      new: [same('src/Ünïcødé/'), changed('deeper/'), same('Plié.cs')],
    });
  });

  it('changes nothing in identical paths', () => {
    expect(pathChangeSegments('src/app.ts', 'src/app.ts')).toEqual({ old: [same('src/app.ts')], new: [same('src/app.ts')] });
  });

  it('gives each path back when its parts are joined', () => {
    const { old, new: now } = pathChangeSegments('/a/b/c/d.txt', '/a/x/c/y/d.txt');
    expect(old.map((part) => part.text).join('')).toBe('/a/b/c/d.txt');
    expect(now.map((part) => part.text).join('')).toBe('/a/x/c/y/d.txt');
  });
});
