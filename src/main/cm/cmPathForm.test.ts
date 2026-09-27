import { describe, expect, it } from 'vitest';
import { inCmPathForm } from './cmPathForm';

const composed = (text: string) => text.normalize('NFC');
const decomposed = (text: string) => text.normalize('NFD');

describe('inCmPathForm', () => {
  const workspace = composed('/Users/josé/wk');

  it('gives cm on macOS the workspace paths decomposed, as it reads them from disk', () => {
    const args = ['checkin', composed(`${workspace}/é.txt`), '--all', '-r', workspace, composed(`${workspace}/ñ.txt#cs:3`)];
    expect(inCmPathForm(args, workspace, 'darwin')).toEqual([
      'checkin',
      decomposed(`${workspace}/é.txt`),
      '--all',
      '-r',
      decomposed(workspace),
      decomposed(`${workspace}/ñ.txt#cs:3`),
    ]);
  });

  it("leaves what is the repository's as it was written: branch names, queries, server paths", () => {
    const args = ['find', 'branch', composed("where name = 'café'"), composed('br:/main/café'), composed('/src/é.cs')];
    expect(inCmPathForm(args, workspace, 'darwin')).toEqual(args);
  });

  it('changes nothing on Windows and Linux, whose disks keep names as they were written', () => {
    const args = ['checkin', composed('/home/josé/wk/é.txt')];
    expect(inCmPathForm(args, composed('/home/josé/wk'), 'linux')).toEqual(args);
    expect(inCmPathForm(['checkin', composed('C:\\wk\\é.txt')], 'C:\\wk', 'win32')).toEqual(['checkin', composed('C:\\wk\\é.txt')]);
  });
});
