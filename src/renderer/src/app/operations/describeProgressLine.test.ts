import { describe, expect, it } from 'vitest';
import { describeProgressLine } from './describeProgressLine';

describe('describeProgressLine', () => {
  it('shows update stages as plain text', () => {
    expect(describeProgressLine('<STAGE:Performing switch operation...>')).toBe('Performing switch operation...');
  });

  it('describes item operations with their file name', () => {
    expect(describeProgressLine('<U:/work/src/readme.md>')).toBe('Updating readme.md');
  });

  it('shows checkin stages and skips the result lines', () => {
    expect(describeProgressLine('STAGE Uploading file data')).toBe('Uploading file data');
    expect(describeProgressLine("CHANGESET cs:4@br:/main@repo@local (mount:'/')")).toBeNull();
  });
});
