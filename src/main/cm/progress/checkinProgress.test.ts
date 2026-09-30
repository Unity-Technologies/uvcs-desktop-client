import { describe, expect, it } from 'vitest';
import { readCheckinProgress } from './checkinProgress';
import { readProgress } from './testing/readProgress';

/** Real output of `cm checkin --all --private -c=… --machinereadable` (1.87 GB, 3020 files), spawned with piped stdout. */
const CHECKIN = [
  'CI_START',
  'STAGE Validating checkin data',
  'STAGE Uploading file data',
  'STAGE Uploading file data 6.89 MB/1.87 GB',
  'STAGE Uploading file data 1.37 GB/1.87 GB',
  'STAGE Confirming checkin operation',
  'STAGE ',
  'CO /private/tmp/prog/wkA',
  'AD /private/tmp/prog/wkA/media/video_1.bin',
  "CHANGESET cs:2@br:/main/task@progtest@local (mount:'/')",
];

describe('readCheckinProgress', () => {
  it('gets ready, cancellable, until bytes go up', () => {
    expect(readProgress(readCheckinProgress, CHECKIN.slice(0, 3))).toEqual({ stage: 'preparing', stageLabel: 'Preparing', fraction: null, cancellable: true });
  });

  it('reads the bytes uploaded, still cancellable: nothing is committed yet', () => {
    expect(readProgress(readCheckinProgress, CHECKIN.slice(0, 5))).toEqual({
      stage: 'uploading',
      stageLabel: 'Uploading',
      bytesDone: Math.round(1.37 * 1024 ** 3),
      bytesTotal: Math.round(1.87 * 1024 ** 3),
      fraction: expect.closeTo(1.37 / 1.87, 6),
      cancellable: true,
    });
  });

  it('confirms after the upload, keeping the total, and can no longer be stopped', () => {
    const confirming = readProgress(readCheckinProgress, CHECKIN.slice(0, 6));
    expect(confirming).toMatchObject({ stage: 'confirming', fraction: null, cancellable: false });
    expect(confirming?.bytesDone).toBe(confirming?.bytesTotal);
  });

  it('finishes at the empty stage and ignores the report after it', () => {
    expect(readProgress(readCheckinProgress, CHECKIN)).toMatchObject({ stage: 'finishing', bytesTotal: Math.round(1.87 * 1024 ** 3) });
  });

  it('reads the first sample, printed as the upload starts', () => {
    expect(readProgress(readCheckinProgress, ['CI_START', 'STAGE Uploading file data 0 bytes/1.07 GB'])).toMatchObject({ stage: 'uploading', bytesDone: 0, fraction: 0 });
  });

  it('counts an upload of nothing (only moves) as complete', () => {
    expect(readProgress(readCheckinProgress, ['STAGE Uploading file data 0 bytes/0 bytes'])).toMatchObject({ fraction: 1 });
  });
});
