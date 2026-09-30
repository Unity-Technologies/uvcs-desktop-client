import { describe, expect, it } from 'vitest';
import { readActivityProgress } from './activityProgress';
import { readProgress } from './testing/readProgress';

describe('readActivityProgress', () => {
  it('shows stages as plain text', () => {
    expect(readProgress(readActivityProgress, ['<STAGE:Performing switch operation...>'])).toEqual({
      stage: 'working',
      stageLabel: 'Performing switch operation...',
      fraction: null,
    });
    expect(readProgress(readActivityProgress, ['STAGE Uploading file data'])?.stageLabel).toBe('Uploading file data');
  });

  it('keeps the stage and shows item paths as the detail', () => {
    expect(readProgress(readActivityProgress, ['Pulling', '<U:/work/src/readme.md>'])).toEqual({
      stage: 'working',
      stageLabel: 'Pulling',
      fraction: null,
      currentItem: '/work/src/readme.md',
    });
  });

  it('skips the result lines', () => {
    expect(readProgress(readActivityProgress, ['Pulling', "CHANGESET cs:4@br:/main@repo@local (mount:'/')"])?.stageLabel).toBe('Pulling');
  });
});
