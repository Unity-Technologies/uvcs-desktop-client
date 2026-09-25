import { describe, expect, it } from 'vitest';
import { describeCompletion, describeProgress, describeProgressBriefly, formatAmount, itemInWorkspace } from './describeProgress';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe('describeProgress', () => {
  it('counts the files being downloaded, with the bytes apart', () => {
    expect(
      describeProgress({ stage: 'downloading', stageLabel: 'Downloading', current: 124, total: 1530, bytesDone: 0.8 * GB, bytesTotal: 1.87 * GB, fraction: 0.43 }),
    ).toEqual({ stage: 'Downloading 124 of 1,530 files', percent: '43%', amount: '0.8 of 1.9 GB' });
  });

  it('counts the changes a merge applies', () => {
    expect(describeProgress({ stage: 'applying', stageLabel: 'Applying changes', current: 3, total: 12, fraction: 0.25 }).stage).toBe('Applying 3 of 12 changes');
  });

  it('shows the stage words alone while nothing is counted', () => {
    expect(describeProgress({ stage: 'calculating', stageLabel: 'Calculating changes', fraction: null })).toEqual({
      stage: 'Calculating changes',
      percent: null,
      amount: null,
    });
    expect(describeProgress({ stage: 'working', stageLabel: 'Shelving your changes', fraction: null, step: { label: 'Shelving your changes', index: 1, count: 4 } }).stage).toBe(
      'Shelving your changes',
    );
  });

  it('names the step while its command gets ready', () => {
    const step = { label: 'Switching', index: 3, count: 4 };
    expect(describeProgress({ stage: 'preparing', stageLabel: 'Preparing', fraction: null, step }).stage).toBe('Switching');
    expect(describeProgress({ stage: 'uploading', stageLabel: 'Uploading', fraction: null, step }).stage).toBe('Uploading');
  });

  it('starts before any progress arrives', () => {
    expect(describeProgress(null).stage).toBe('Starting');
  });

  it('never rounds up to 100% before the end', () => {
    expect(describeProgress({ stage: 'uploading', stageLabel: 'Uploading', fraction: 0.996 }).percent).toBe('99%');
  });
});

describe('describeProgressBriefly', () => {
  it('leads with the percentage and the bytes', () => {
    expect(describeProgressBriefly({ stage: 'downloading', stageLabel: 'Downloading', current: 1, total: 9, bytesDone: 34 * MB, bytesTotal: 120 * MB, fraction: 0.28 })).toBe(
      '28% · 34 of 120 MB',
    );
    expect(describeProgressBriefly({ stage: 'applying', stageLabel: 'Applying changes', current: 3, total: 12, fraction: 0.25 })).toBe('25% · Applying 3 of 12 changes');
  });

  it('says the stage while it cannot tell how far along it is', () => {
    expect(describeProgressBriefly({ stage: 'calculating', stageLabel: 'Calculating changes', fraction: null })).toBe('Calculating changes');
  });
});

describe('formatAmount', () => {
  it('writes both numbers in the unit of the total', () => {
    expect(formatAmount(34 * MB, 120 * MB)).toBe('34 of 120 MB');
    expect(formatAmount(700 * 1024, 1.5 * MB)).toBe('0.7 of 1.5 MB');
    expect(formatAmount(12, 800)).toBe('12 of 800 bytes');
  });

  it('never shows more done than the total', () => {
    expect(formatAmount(2 * GB, GB)).toBe('1.0 of 1.0 GB');
  });
});

describe('describeCompletion', () => {
  it('sums up downloads, uploads and merges', () => {
    expect(describeCompletion({ stage: 'finishing', stageLabel: 'Finishing', current: 3020, total: 3020, bytesDone: 1.87 * GB, bytesTotal: 1.87 * GB, fraction: 1 })).toBe(
      '3,020 files updated · 1.9 GB',
    );
    expect(describeCompletion({ stage: 'finishing', stageLabel: 'Finishing', bytesTotal: 1.87 * GB, fraction: null })).toBe('1.9 GB uploaded');
    expect(describeCompletion({ stage: 'finishing', stageLabel: 'Writing files', current: 1, total: 1, fraction: null })).toBe('1 change applied');
  });

  it('says nothing when nothing was counted', () => {
    expect(describeCompletion({ stage: 'working', stageLabel: 'Undoing them here', fraction: null })).toBeNull();
    expect(describeCompletion({ stage: 'preparing', stageLabel: 'Preparing', fraction: null })).toBeNull();
    expect(describeCompletion(null)).toBeNull();
  });
});

describe('itemInWorkspace', () => {
  it('shows the path inside the workspace', () => {
    expect(itemInWorkspace('/private/tmp/prog/wkA/gen/f1.txt', '/tmp/prog/wkA')).toBe('gen/f1.txt');
    expect(itemInWorkspace('C:\\wk\\src\\a.txt', 'C:\\wk')).toBe('src/a.txt');
    expect(itemInWorkspace('/elsewhere/a.txt', '/wk')).toBe('/elsewhere/a.txt');
  });
});
