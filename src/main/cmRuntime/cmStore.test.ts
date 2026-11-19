import { readFileSync } from 'node:fs';
import { join, posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmStoreEntries, cmStoreFolder, managedCmPath, storeEntriesToPrune } from './cmStore';

describe('cmStoreFolder', () => {
  it('is in the local, not the roaming, app data on Windows', () => {
    expect(cmStoreFolder('win32', { LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' }, 'C:\\Users\\ana')).toBe(
      win32.join('C:\\Users\\ana\\AppData\\Local', 'Unity Version Control', 'cm'),
    );
  });

  it('falls back to the profile when Windows has no LOCALAPPDATA', () => {
    expect(cmStoreFolder('win32', {}, 'C:\\Users\\ana')).toBe(win32.join('C:\\Users\\ana', 'AppData', 'Local', 'Unity Version Control', 'cm'));
  });

  it('is in Application Support on macOS, never Caches, which the OS may empty', () => {
    expect(cmStoreFolder('darwin', {}, '/Users/ana')).toBe(posix.join('/Users/ana', 'Library', 'Application Support', 'Unity Version Control', 'cm'));
  });

  it('follows XDG_DATA_HOME on Linux, ~/.local/share without it', () => {
    expect(cmStoreFolder('linux', { XDG_DATA_HOME: '/data/ana' }, '/home/ana')).toBe(posix.join('/data/ana', 'unity-version-control', 'cm'));
    expect(cmStoreFolder('linux', {}, '/home/ana')).toBe(posix.join('/home/ana', '.local', 'share', 'unity-version-control', 'cm'));
  });
});

describe('managedCmPath', () => {
  it('is in the version’s client folder, cm.exe on Windows', () => {
    expect(managedCmPath('C:\\store', '11.0.16.10659', 'win32')).toBe(win32.join('C:\\store', '11.0.16.10659', 'client', 'cm.exe'));
    expect(managedCmPath('/store', '11.0.16.10659', 'linux')).toBe(posix.join('/store', '11.0.16.10659', 'client', 'cm'));
  });
});

describe('cmStoreEntries', () => {
  it('names a version’s folder and the two on the way to it', () => {
    expect(cmStoreEntries('/store', '11.0.16.10659', 'darwin')).toEqual({
      installed: posix.join('/store', '11.0.16.10659'),
      partial: posix.join('/store', '11.0.16.10659.partial'),
      unpacking: posix.join('/store', '11.0.16.10659.unpacking'),
    });
  });
});

describe('storeEntriesToPrune', () => {
  it('deletes every older version, finished or not', () => {
    const names = ['11.0.16.9000', '11.0.16.10659', '11.0.16.9000.unpacking', '11.0.16.10600.partial'];
    expect(storeEntriesToPrune(names, '11.0.16.10659')).toEqual(['11.0.16.10600.partial', '11.0.16.9000', '11.0.16.9000.unpacking']);
  });

  it('keeps the newest version above the pinned one, an update’s, and deletes newer ones it replaced', () => {
    const names = ['11.0.16.10659', '11.0.16.10700', '11.0.16.10800', '11.0.16.10800.partial'];
    expect(storeEntriesToPrune(names, '11.0.16.10659')).toEqual(['11.0.16.10700']);
  });

  it('keeps what is half done of the pinned version, which the next attempt resumes', () => {
    expect(storeEntriesToPrune(['11.0.16.10659.partial'], '11.0.16.10659')).toEqual([]);
  });

  it('leaves alone anything that is not a version', () => {
    expect(storeEntriesToPrune(['.DS_Store', 'notes', 'latest'], '11.0.16.10659')).toEqual([]);
  });
});

describe('the Windows uninstaller', () => {
  // Checked out with CRLF on Windows.
  const script = readFileSync(join(__dirname, '../../../build/installer.nsh'), 'utf8').replace(/\r\n/g, '\n');

  it('removes the store cmStoreFolder names, but not on an update, which keeps it for the new version', () => {
    const store = cmStoreFolder('win32', { LOCALAPPDATA: '$LOCALAPPDATA' }, '');
    const uninstall = script.slice(script.indexOf('!macro customUnInstall'));
    expect(uninstall).toContain(`\${ifNot} \${isUpdated}\n    RMDir /r "${store}"`);
  });
});
