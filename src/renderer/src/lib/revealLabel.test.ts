import { describe, expect, it } from 'vitest';
import { openFolderLabel, revealLabel } from './revealLabel';

describe('revealLabel', () => {
  it("names each OS's file manager", () => {
    expect(revealLabel('darwin')).toBe('Reveal in Finder');
    expect(revealLabel('win32')).toBe('Show in Explorer');
    expect(revealLabel('linux')).toBe('Show in file manager');
  });
});

describe('openFolderLabel', () => {
  it("names opening a folder in each OS's file manager", () => {
    expect(openFolderLabel('darwin')).toBe('Open in Finder');
    expect(openFolderLabel('win32')).toBe('Open in Explorer');
    expect(openFolderLabel('linux')).toBe('Open in file manager');
  });
});
