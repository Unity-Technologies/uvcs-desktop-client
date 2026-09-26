import { describe, expect, it } from 'vitest';
import { readProgress } from './progressReader';
import { readUpdateProgress } from './updateProgress';

/** Real output of `cm switch /main/task --noinput --forcedetailedprogress`, spawned with piped stdout, split at \r and \n. */
const SWITCH = [
  'Searching for changed items in the workspace...',
  'Performing switch operation...',
  'Setting the new selector...',
  'Unity VCS is updating your workspace. Wait a moment, please...',
  '',
  '- Updating       [########............]  40%  0.75/1.87 GB -    8/3020 files',
  '\\ Updating       [##################..]  94%  1.77/1.87 GB -   19/3020 files',
  '| Updating       [###################.]  99%  1.86/1.87 GB -   20/3020 files',
  '/ Finished       [####################] 100%  1.87/1.87 GB - 3020/3020 files',
  '',
];

/**
 * Real output of `cm update --forcedetailedprogress` in a workspace getting one 800 MB file and 8,000 small ones, a
 * line every 200 ms ("files" cut to fit 80 columns). `cm` writes the big file first, so its percentage (by bytes) reads
 * 99% with 1 of 8,001 files written, then 100% "Finished" while most of them are still being written.
 */
const ONE_BIG_MANY_SMALL = [
  'Unity VCS is updating your workspace. Wait a moment, please...',
  '- Calculating    [########............]  41%  ',
  '\\ Calculating    [###################.]  99%  ',
  '- Updating       [###################.]  99%     800/800.08 MB -    1/8001 fil',
  '\\ Updating       [###################.]  99%     800/800.08 MB -    1/8001 fil',
  '| Finished       [####################] 100%  800.08/800.08 MB - 2609/8001 fil',
  '/ Finished       [####################] 100%  800.08/800.08 MB - 3890/8001 fil',
  '- Finished       [####################] 100%  800.08/800.08 MB - 4986/8001 fil',
  '\\ Finished       [####################] 100%  800.08/800.08 MB - 5924/8001 fil',
  '| Finished       [####################] 100%  800.08/800.08 MB - 6709/8001 fil',
  '/ Finished       [####################] 100%  800.08/800.08 MB - 7401/8001 fil',
  '- Finished       [####################] 100%  800.08/800.08 MB - 8001/8001 fil',
  '\\ Finished       [####################] 100%  800.08/800.08 MB - 8001/8001 fil',
  '',
];

const GB = 1024 ** 3;
const MB = 1024 ** 2;
/** What each file weighs in besides its bytes. */
const FILE = 128 * 1024;

describe('readUpdateProgress', () => {
  it('prepares, cancellable, until the progress line shows up', () => {
    expect(readProgress(readUpdateProgress, SWITCH.slice(0, 4))).toEqual({
      stage: 'preparing',
      stageLabel: 'Preparing',
      fraction: null,
      cancellable: true,
    });
  });

  it('reads bytes and files while downloading, and stops offering to cancel', () => {
    expect(readProgress(readUpdateProgress, SWITCH.slice(0, 6))).toEqual({
      stage: 'downloading',
      stageLabel: 'Downloading',
      current: 8,
      total: 3020,
      bytesDone: Math.round(0.75 * GB),
      bytesTotal: Math.round(1.87 * GB),
      fraction: expect.closeTo((0.75 * GB + 8 * FILE) / (1.87 * GB + 3020 * FILE), 6),
      currentItem: undefined,
      cancellable: false,
    });
  });

  it('measures mostly by bytes while the files are big', () => {
    expect(readProgress(readUpdateProgress, SWITCH.slice(0, 8))?.fraction).toBeCloseTo(0.83, 2);
  });

  it("doesn't read 99% with 1 of 8,001 files written: each file weighs in besides its bytes", () => {
    expect(readProgress(readUpdateProgress, ONE_BIG_MANY_SMALL.slice(0, 4))).toMatchObject({
      stage: 'downloading',
      current: 1,
      total: 8001,
      bytesDone: 800 * MB,
      fraction: expect.closeTo(0.44, 2),
    });
    // `cm` says "Finished" by bytes: the files still being written keep it downloading.
    expect(readProgress(readUpdateProgress, ONE_BIG_MANY_SMALL.slice(0, 6))).toMatchObject({
      stage: 'downloading',
      current: 2609,
      fraction: expect.closeTo(0.63, 2),
    });
  });

  it('only moves forwards, and ends full', () => {
    for (const lines of [SWITCH, ONE_BIG_MANY_SMALL]) {
      const fractions = lines.map((_, index) => readProgress(readUpdateProgress, lines.slice(0, index + 1))?.fraction ?? 0);
      expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
      expect(fractions.at(-1)).toBe(1);
    }
  });

  it('finishes once every byte and file is there, and keeps it through the trailing lines', () => {
    expect(readProgress(readUpdateProgress, SWITCH)).toMatchObject({ stage: 'finishing', fraction: 1, current: 3020, total: 3020 });
    expect(readProgress(readUpdateProgress, [...SWITCH, 'The update operation detected conflicts'])).toMatchObject({ stage: 'finishing' });
  });

  it('reads megabytes (real `cm update --forcedetailedprogress` output)', () => {
    expect(readProgress(readUpdateProgress, ['- Updating       [###.................]  17%   55.68/319.56 MB -   1/506 files'])).toMatchObject({
      bytesDone: Math.round(55.68 * 1024 ** 2),
      bytesTotal: Math.round(319.56 * 1024 ** 2),
      current: 1,
      total: 506,
    });
  });

  // Built from UpdateProgressBuilder's format: the totals are left out while calculating, and the file being written
  // is appended when the line fits in 80 columns (always the width with redirected output).
  it('calculates before the totals are known', () => {
    expect(readProgress(readUpdateProgress, ['- Calculating    [#...................]   1%  '])).toMatchObject({ stage: 'calculating', fraction: null, cancellable: true });
  });

  it('keeps the file being written as a detail', () => {
    expect(readProgress(readUpdateProgress, ['| Updating       [#...................]   5%  1.5/30 KB - 1/3 files - /src/a.txt'])?.currentItem).toBe('/src/a.txt');
  });

  it('reads localized output by its shape', () => {
    expect(readProgress(readUpdateProgress, ['- Actualizando   [##########..........]  50%  1,5/3 MB - 2/4 archivos'])).toMatchObject({
      stage: 'downloading',
      bytesDone: Math.round(1.5 * 1024 ** 2),
      fraction: 0.5,
    });
  });

  it('stays preparing when nothing has to be downloaded (a switch that only deletes prints no progress line)', () => {
    expect(readProgress(readUpdateProgress, ['Performing switch operation...', '', ''])).toMatchObject({ stage: 'preparing' });
  });
});
