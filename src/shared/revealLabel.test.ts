import { describe, expect, it } from 'vitest';
import { openInFileManagerLabel, revealLabel } from './revealLabel';

describe('revealLabel', () => {
  it("names each OS's file manager", () => {
    expect(revealLabel('darwin')).toBe('Reveal in Finder');
    expect(revealLabel('win32')).toBe('Show in Explorer');
    expect(revealLabel('linux')).toBe('Show in file manager');
  });

  it("opens a folder's contents in each OS's file manager", () => {
    expect(openInFileManagerLabel('darwin')).toBe('Open in Finder');
    expect(openInFileManagerLabel('win32')).toBe('Open in Explorer');
    expect(openInFileManagerLabel('linux')).toBe('Open in file manager');
  });
});
