import { describe, expect, it } from 'vitest';
import { MERGE_FIELD_SEPARATOR } from '../mergeOutput';
import { readMergeProgress } from './mergeProgress';
import { readProgress } from './testing/readProgress';

/** Real `cm merge br:/main/task --merge --nointeractiveresolution --machinereadable --fieldseparator=…` output, written with `|`. */
const MERGE = [
  'APPLY|ADD|/gen',
  'APPLY|ADD|/media',
  'APPLY|ADD|/media/video_17.bin',
  'DO_COPIED|/private/tmp/prog/wkA/gen',
  'DO_COPIED|/private/tmp/prog/wkA/media',
  'DO_COPIED|/private/tmp/prog/wkA/media/video_17.bin',
].map((line) => line.split('|').join(MERGE_FIELD_SEPARATOR));

describe('readMergeProgress', () => {
  it('counts the plan while calculating', () => {
    expect(readProgress(readMergeProgress, MERGE.slice(0, 3))).toEqual({
      stage: 'calculating',
      stageLabel: 'Calculating changes',
      current: 0,
      total: 3,
      fraction: null,
      cancellable: true,
    });
  });

  it('counts the changes applied against it', () => {
    expect(readProgress(readMergeProgress, MERGE.slice(0, 4))).toEqual({
      stage: 'applying',
      stageLabel: 'Applying changes',
      current: 1,
      total: 3,
      fraction: 1 / 3,
      currentItem: '/private/tmp/prog/wkA/gen',
      cancellable: false,
    });
  });

  it('downloads the files, unmeasured, once every change is set up', () => {
    expect(readProgress(readMergeProgress, MERGE)).toMatchObject({ stage: 'downloading', stageLabel: 'Downloading files', current: 3, total: 3, fraction: null });
  });

  it('ignores other records', () => {
    expect(readProgress(readMergeProgress, [`CONTRIBUTOR${MERGE_FIELD_SEPARATOR}SRC`])).toBeNull();
  });
});
