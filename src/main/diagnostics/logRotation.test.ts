import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { earlierLogFiles, rotatesBefore, rotationRenames } from './logRotation';

const FOLDER = join('logs', 'uvcs');
const FILE = join(FOLDER, 'uvcs-desktop.log');

describe('earlierLogFiles', () => {
  it('numbers the earlier files before their extension, newest first', () => {
    expect(earlierLogFiles(FILE, 2)).toEqual([join(FOLDER, 'uvcs-desktop.1.log'), join(FOLDER, 'uvcs-desktop.2.log')]);
  });
});

describe('rotationRenames', () => {
  it('moves the oldest kept file first, so no file is overwritten before it moved on', () => {
    expect(rotationRenames(FILE, 2)).toEqual([
      { from: join(FOLDER, 'uvcs-desktop.1.log'), to: join(FOLDER, 'uvcs-desktop.2.log') },
      { from: FILE, to: join(FOLDER, 'uvcs-desktop.1.log') },
    ]);
  });
});

describe('rotatesBefore', () => {
  it('rotates once the file would grow past its size', () => {
    expect(rotatesBefore(900, 100, 1000)).toBe(false);
    expect(rotatesBefore(901, 100, 1000)).toBe(true);
  });

  it('never rotates an empty file, even for a record bigger than the size', () => {
    expect(rotatesBefore(0, 5000, 1000)).toBe(false);
  });
});
