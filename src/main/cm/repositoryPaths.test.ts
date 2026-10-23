import { describe, expect, it } from 'vitest';
import { RecordReader } from './formatRecords';
import { formatOutput } from './testing/cmOutput';
import { listedPathLine, readListedPath, readListedPathLine, repositoryPathsArgs } from './repositoryPaths';

describe('repositoryPathsArgs', () => {
  it("lists the whole tree at a changeset, its items' type and path alone", () => {
    expect(repositoryPathsArgs('cs:12@game@local')).toEqual(['ls', '/', '-R', '--tree=cs:12@game@local', '--format={type}\u001f{path}\u001e']);
  });
});

describe('readListedPath', () => {
  it('reads each item as cm prints it, without the leading slash, and leaves out the root', () => {
    const output = formatOutput(['dir', '/'], ['dir', '/Assets'], ['txt', '/Assets/Player.cs'], ['bin', '/Assets/Ñandú café.png'], ['dir', '/lib/theme']);
    const reader = new RecordReader(readListedPath);
    reader.read(Buffer.from(output, 'utf8'));

    expect(reader.finish()).toEqual([
      { path: 'Assets', isDirectory: true },
      { path: 'Assets/Player.cs', isDirectory: false },
      { path: 'Assets/Ñandú café.png', isDirectory: false },
      { path: 'lib/theme', isDirectory: true },
    ]);
  });

  it('reads the paths Windows prints, its separators made forward slashes as the tree names them', () => {
    const reader = new RecordReader(readListedPath);
    reader.read(Buffer.from(formatOutput(['dir', '/'], ['dir', '/Assets'], ['txt', '/Assets\\Scripts\\Player.cs']), 'utf8'));

    expect(reader.finish()).toEqual([
      { path: 'Assets', isDirectory: true },
      { path: 'Assets/Scripts/Player.cs', isDirectory: false },
    ]);
  });

  it('reads an xlink as the folder the listing walks into', () => {
    const reader = new RecordReader(readListedPath);
    reader.read(Buffer.from(formatOutput(['dir', '/'], ['xlink', '/lib'], ['txt', '/lib/theme.css']), 'utf8'));

    expect(reader.finish()).toEqual([
      { path: 'lib', isDirectory: true },
      { path: 'lib/theme.css', isDirectory: false },
    ]);
  });
});

describe('a tree file line', () => {
  it('reads back as written, folders and files apart', () => {
    for (const item of [{ path: 'Assets', isDirectory: true }, { path: 'Assets/A file with spaces.cs', isDirectory: false }]) {
      expect(readListedPathLine(listedPathLine(item).trimEnd())).toEqual(item);
    }
  });

  it('leaves out an item whose path holds a line break, so every line is one item', () => {
    expect(listedPathLine({ path: 'odd\nname.txt', isDirectory: false })).toBe('');
  });

  it('reads nothing from an empty or unknown line', () => {
    expect(readListedPathLine('')).toBeUndefined();
    expect(readListedPathLine('d')).toBeUndefined();
    expect(readListedPathLine('xAssets')).toBeUndefined();
  });
});
