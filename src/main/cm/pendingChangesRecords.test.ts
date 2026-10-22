import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { RecordReader } from './formatRecords';
import { listedCodes, PendingChangesReader, statusRecordsArgs } from './pendingChangesRecords';
import { change, formatOutput, pendingStatus, pendingStatusInChangelists } from './testing/cmOutput';

const WORKSPACE = join('/', 'work', 'game');

/** Reads `output` as `CmClient.queryRecords` does: the records as they arrive, then the snapshot. */
function read(output: string, workspacePath = WORKSPACE, platform: NodeJS.Platform = process.platform) {
  const reader = new PendingChangesReader(workspacePath, platform);
  const records = new RecordReader(reader.read);
  records.read(Buffer.from(output, 'utf8'));
  return reader.snapshot(records.finish());
}

describe('statusRecordsArgs', () => {
  it('asks cm status for records split by control characters, after its own options', () => {
    expect(statusRecordsArgs('--private', '--changelists')).toEqual(['status', '--private', '--changelists', '--machinereadable', '--fieldseparator=\u001f', '--endlineseparator=\u001e']);
  });
});

describe('PendingChangesReader', () => {
  it('reads each change with its path relative to the workspace, and nothing empty for tens of thousands of them', () => {
    const { changes, changelists, mergeLinks } = read(pendingStatus(WORKSPACE, change('CH', 'src/b.ts'), change('PR', 'new.txt')));

    expect(changes).toEqual([
      { path: 'src/b.ts', kinds: ['changed'], itemType: 'file', size: 0, lastModified: '' },
      { path: 'new.txt', kinds: ['private'], itemType: 'file', size: 0, lastModified: '' },
    ]);
    // Nothing empty goes over IPC for each of tens of thousands of changes.
    expect(Object.keys(changes[1]!)).toEqual(['path', 'kinds', 'itemType', 'size', 'lastModified']);
    expect(changelists).toEqual([]);
    expect(mergeLinks).toEqual([]);
  });

  it('reads a folder, paths with spaces and names in other scripts as cm prints them', () => {
    const { changes } = read(pendingStatus(WORKSPACE, change('PR', 'with space/new file.txt'), change('PR', 'Ünïcødé/Neü.txt'), change('AD', 'assets', { folder: true })));

    expect(changes.map(({ path, itemType }) => [path, itemType])).toEqual([
      ['with space/new file.txt', 'file'],
      ['Ünïcødé/Neü.txt', 'file'],
      ['assets', 'directory'],
    ]);
  });

  it('reads a move with where it was and how similar it stayed, in any culture cm prints the percentage in', () => {
    const output = pendingStatus(
      WORKSPACE,
      change('MV', 'src/moved-to.txt', { oldPath: 'src/moved.txt' }),
      change('LM', 'src/localmoved.txt', { oldPath: 'src/localmove.txt', similarity: '85,6%' }),
      change('CH+MV', 'docs/a.ts', { oldPath: 'src/a.ts', similarity: '97.5%' }),
    );

    expect(read(output).changes).toEqual([
      { path: 'src/moved-to.txt', oldPath: 'src/moved.txt', similarityPercent: 100, kinds: ['moved'], itemType: 'file', size: 0, lastModified: '' },
      { path: 'src/localmoved.txt', oldPath: 'src/localmove.txt', similarityPercent: 86, kinds: ['locallyMoved'], itemType: 'file', size: 0, lastModified: '' },
      { path: 'docs/a.ts', oldPath: 'src/a.ts', similarityPercent: 98, kinds: ['changed', 'moved'], itemType: 'file', size: 0, lastModified: '' },
    ]);
  });

  it('lists the merges the changes come from, each once, joined as cm status --xml joined them', () => {
    const output = pendingStatus(
      WORKSPACE,
      change('RP', 'a.ts', { merge: 'Merge from 242' }),
      change('CO+CH', 'b.ts', { merge: 'Merge from 242+Cherrypick from 3 to 7' }),
      change('CH', 'c.ts'),
    );
    const { changes, mergeLinks } = read(output);

    expect(changes.map((item) => item.mergeInfo)).toEqual(['Merge from 242', 'Merge from 242, Cherrypick from 3 to 7', undefined]);
    expect(mergeLinks).toEqual([
      { type: 'merge', sourceChangeset: 242 },
      { type: 'intervalCherryPick', sourceChangeset: 7, intervalStart: 3 },
    ]);
  });

  it("assigns changes to their changelists, cm's own included, and keeps an item in several in the first", () => {
    const output = pendingStatusInChangelists(WORKSPACE, [
      { name: 'Default', description: 'Default Unity VCS changelist', changes: [change('PR', 'a.txt')] },
      { name: 'UI work', description: 'polish', changes: [change('CO+CH', 'b.txt'), change('CO', 'c.txt')] },
      { name: 'Merge from cs:2', description: 'Files affected by the merge process', changes: [change('RP', 'm.txt', { merge: 'Merge from 2' })] },
      { name: 'Hidden changes', changes: [change('CO', 'c.txt'), change('CH+HC', 'h.txt')] },
    ]);
    const { changes, changelists } = read(output);

    expect(changelists).toEqual([
      { name: 'UI work', description: 'polish' },
      { name: 'Merge from cs:2', description: 'Files affected by the merge process' },
      { name: 'Hidden changes', description: '' },
    ]);
    expect(changes.map((item) => [item.path, item.changelist, item.kinds])).toEqual([
      ['a.txt', undefined, ['private']],
      ['b.txt', 'UI work', ['checkedOut', 'changed']],
      ['c.txt', 'UI work', ['checkedOut']],
      ['m.txt', 'Merge from cs:2', ['replaced']],
      ['h.txt', 'Hidden changes', ['changed', 'hiddenChanged']],
    ]);
  });

  it('skips the header and the files left with conflict markers, which are no changes', () => {
    const output = formatOutput(['STATUS', 7, 'game', 'local'], ['CH', join(WORKSPACE, 'a.txt'), 'False', 'NO_MERGES'], ['CONFLICT_MARKERS', join(WORKSPACE, 'a.txt')]);
    expect(read(output).changes.map((item) => item.path)).toEqual(['a.txt']);
  });

  it('reads the output of cm on Windows: CRLF line breaks and backslashes in paths', () => {
    const output = [
      'STATUS\u001f1\u001fgame\u001flocal\u001e',
      'MV\u001f100%\u001fC:\\work\\game\\Assets\\a.cs\u001fC:\\work\\game\\Assets\\Scripts\\b.cs\u001fFalse\u001fNO_MERGES\u001e',
      'PR\u001fC:\\work\\game\\Assets\\new file.txt\u001fFalse\u001fNO_MERGES\u001e',
      '',
    ].join('\r\n');

    expect(read(output, 'C:\\work\\game', 'win32').changes.map((item) => [item.path, item.oldPath])).toEqual([
      ['Assets/Scripts/b.cs', 'Assets/a.cs'],
      ['Assets/new file.txt', undefined],
    ]);
  });

  it("reads paths under the workspace's root however cm spells it: another case, decomposed accents", () => {
    const windows = 'PR\u001fc:\\Work\\Game\\a.txt\u001fFalse\u001fNO_MERGES\u001e\r\n';
    expect(read(windows, 'C:\\work\\game', 'win32').changes.map((item) => item.path)).toEqual(['a.txt']);

    const decomposed = `PR\u001f/Users/Jose\u0301/game/a.txt\u001fFalse\u001fNO_MERGES\u001e\nPR\u001f/Users/Jose\u0301/game/b.txt\u001fFalse\u001fNO_MERGES\u001e\n`;
    expect(read(decomposed, '/users/josé/game', 'darwin').changes.map((item) => item.path)).toEqual(['a.txt', 'b.txt']);
  });

  it('fails on a path outside the workspace rather than list it as one of its files', () => {
    const output = `PR\u001f/elsewhere/a.txt\u001fFalse\u001fNO_MERGES\u001e\n`;
    expect(() => read(output, '/work/game', 'linux')).toThrow('cm printed a path outside the workspace /work/game: /elsewhere/a.txt');
  });

  it('reads the workspace root itself as the empty path', () => {
    expect(read(`CO\u001f/work/game\u001fTrue\u001fNO_MERGES\u001e\n`, '/work/game', 'linux').changes.map((item) => item.path)).toEqual(['']);
  });

  it('reads thousands of changes matching the root once, with one array of kinds per combination of codes', () => {
    const count = 5_000;
    const records = Array.from({ length: count }, (_, index) => [index % 3 ? 'CH' : 'PR', `/work/game/src/folder${index % 100}/file_${index}.ts`, 'False', 'NO_MERGES']);
    // The app has the root in another case than cm prints it: matched by folders, ignoring case, once.
    const { result, calls } = countCalls(String.prototype, 'toLowerCase', () => read(formatOutput(...records), '/work/Game', 'darwin'));

    expect(result.changes).toHaveLength(count);
    expect(calls).toBe(2);
    expect(new Set(result.changes.map((item) => item.kinds)).size).toBe(2);
  });
});

describe('listedCodes', () => {
  it.each([
    ['a deleted item, whatever else it was', 'DE+CO+CH', ['DE']],
    ['a locally deleted one', 'LD+CO', ['LD']],
    ['an added item, even changed after', 'AD+CH', ['AD']],
    ['a private one', 'PR', ['PR']],
    ['an ignored one', 'IG', ['IG']],
    ['a checkout, with what it carries', 'CO+RP', ['CO', 'RP']],
    ['a checkout of a changed file', 'CO+CH+CL', ['CO', 'CH', 'CL']],
    ['a change, cloaked and hidden', 'CH+CL+HC', ['CH', 'CL', 'HC']],
    ['a copy checked out', 'CO+CP', ['CO', 'CP']],
    ['a replaced item', 'RP', ['RP']],
    ['a copied one', 'CP', ['CP']],
    ['a move that changed too', 'CH+MV', ['CH', 'MV']],
    ['a local move', 'LM', ['LM']],
    ['a private item moved', 'PR+LM', ['PR', 'LM']],
  ])('lists %s as cm status --xml did', (_, codes, listed) => {
    expect(listedCodes(new Set(codes.split('+')))).toEqual(listed);
  });

  it('lists no item that is in no category: a cloaked folder, a folder holding changes', () => {
    expect(listedCodes(new Set(['CL']))).toEqual([]);
    expect(listedCodes(new Set(['DC']))).toEqual([]);
  });
});
