import { describe, expect, it } from 'vitest';
import { RecordReader } from './formatRecords';
import { partialConfigureArgs, readTopFolder, topFoldersArgs } from './partialWorkspace';
import { formatOutput } from './testing/cmOutput';

describe('partialConfigureArgs', () => {
  it('loads each chosen folder, quietly', () => {
    expect(partialConfigureArgs(['Assets', 'Docs ñ'])).toEqual(['partial', 'configure', '+/Assets', '+/Docs ñ', '--silent']);
  });
});

describe('topFoldersArgs', () => {
  it('lists only the root of /main, its type and path', () => {
    expect(topFoldersArgs('game@local')).toEqual(['ls', '/', '--tree=br:/main@game@local', '--format={type}\u001f{path}\u001e']);
  });
});

describe('readTopFolder', () => {
  function read(output: string): string[] {
    const reader = new RecordReader(readTopFolder);
    reader.read(Buffer.from(output, 'utf8'));
    return reader.finish();
  }

  it('keeps folders and xlinks, leaving out the root and files', () => {
    const output = formatOutput(['dir', '/'], ['dir', '/Assets'], ['xlink', '/Shared'], ['txt', '/README.md'], ['bin', '/logo.png']);
    expect(read(output)).toEqual(['Assets', 'Shared']);
  });

  it('reads the backslashes cm writes on Windows', () => {
    expect(read(formatOutput(['dir', '\\Ñandú Assets']))).toEqual(['Ñandú Assets']);
  });

  it('reads nothing from an empty repository', () => {
    expect(read(formatOutput(['dir', '/']))).toEqual([]);
  });
});
