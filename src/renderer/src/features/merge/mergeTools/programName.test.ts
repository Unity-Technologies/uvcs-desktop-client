import { describe, expect, it } from 'vitest';
import { programName } from './programName';

describe('programName', () => {
  it('names a macOS program by the app it is inside', () => {
    expect(programName('/Applications/Beyond Compare.app/Contents/MacOS/bcomp')).toBe('Beyond Compare');
  });

  it('names a Windows program by its file, without the launcher extension', () => {
    expect(programName('C:\\Program Files\\Tool\\merge.exe')).toBe('merge');
    expect(programName('C:\\Users\\ana\\bin\\code.CMD')).toBe('code');
  });

  it('names a Linux program by its file', () => {
    expect(programName('/usr/bin/meld')).toBe('meld');
  });
});
