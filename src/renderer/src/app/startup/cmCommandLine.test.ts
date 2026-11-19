import { describe, expect, it } from 'vitest';
import { cmCommandLine } from './cmCommandLine';

describe('cmCommandLine', () => {
  it('names a cm found on the PATH as cm', () => {
    expect(cmCommandLine('cm', 'configure', 'darwin')).toBe('cm configure');
    expect(cmCommandLine('cm.exe', 'configure', 'win32')).toBe('cm configure');
  });

  it('names the app’s own cm in full, quoted for a POSIX shell', () => {
    expect(cmCommandLine('/Users/ana/Library/Application Support/Unity Version Control/cm/11.0.16.10659/client/cm', 'configure', 'darwin')).toBe(
      "'/Users/ana/Library/Application Support/Unity Version Control/cm/11.0.16.10659/client/cm' configure",
    );
    expect(cmCommandLine("/home/o'neil/.local/share/unity-version-control/cm/11.0.16.10659/client/cm", 'configure', 'linux')).toBe(
      "'/home/o'\\''neil/.local/share/unity-version-control/cm/11.0.16.10659/client/cm' configure",
    );
  });

  it('runs it with & in PowerShell on Windows', () => {
    expect(cmCommandLine('C:\\Users\\José\\AppData\\Local\\Unity Version Control\\cm\\11.0.16.10659\\client\\cm.exe', 'configure', 'win32')).toBe(
      '& "C:\\Users\\José\\AppData\\Local\\Unity Version Control\\cm\\11.0.16.10659\\client\\cm.exe" configure',
    );
  });
});
