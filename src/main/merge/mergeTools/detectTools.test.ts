import { describe, expect, it } from 'vitest';
import { detectKnownTools, type ToolFileSystem } from './detectTools';
import { KNOWN_TOOLS, type Whereabouts } from './knownTools';

function fakeFileSystem(paths: string[]): ToolFileSystem {
  return {
    exists: (path) => paths.includes(path),
    list: (folder) => [...new Set(paths.filter((path) => path.startsWith(folder + (folder.includes('\\') ? '\\' : '/'))).map((path) => path.slice(folder.length + 1).split(/[\\/]/)[0]!))],
  };
}

const mac: Whereabouts = { platform: 'darwin', env: { PATH: '/usr/bin:/usr/local/bin' }, home: '/Users/me', cmPath: '/usr/local/bin/cm' };
const windows: Whereabouts = {
  platform: 'win32',
  env: { Path: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', ProgramFiles: 'C:\\Program Files' },
  home: 'C:\\Users\\me',
  cmPath: 'C:\\Program Files\\PlasticSCM5\\client\\cm.exe',
};

const found = (where: Whereabouts, paths: string[]) => detectKnownTools(KNOWN_TOOLS, where, fakeFileSystem(paths)).map(({ tool, executable }) => [tool.id, executable]);

describe('detectKnownTools', () => {
  it('finds macOS apps in /Applications and ~/Applications, then on the PATH', () => {
    expect(
      found(mac, [
        '/Applications/PlasticSCM.app/Contents/MacOS/macplasticx',
        '/Users/me/Applications/Rider.app/Contents/MacOS/rider',
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
        '/usr/local/bin/p4merge',
      ]),
    ).toEqual([
      ['uvcs', '/Applications/PlasticSCM.app/Contents/MacOS/macplasticx'],
      ['vscode', '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'],
      ['rider', '/Users/me/Applications/Rider.app/Contents/MacOS/rider'],
      ['p4merge', '/usr/local/bin/p4merge'],
    ]);
  });

  it('offers FileMerge only with Xcode, though `opendiff` is always there', () => {
    expect(found(mac, ['/usr/bin/opendiff'])).toEqual([]);
    expect(found(mac, ['/usr/bin/opendiff', '/Applications/Xcode.app/Contents/Applications/FileMerge.app'])).toEqual([['opendiff', '/usr/bin/opendiff']]);
  });

  it('finds the UVCS tool next to cm on Windows, and the newest versioned JetBrains folder', () => {
    expect(
      found(windows, [
        'C:\\Program Files\\PlasticSCM5\\client\\plastic.exe',
        'C:\\Program Files\\JetBrains\\JetBrains Rider 2025.1\\bin\\rider64.exe',
        'C:\\Program Files\\JetBrains\\JetBrains Rider 2026.2\\bin\\rider64.exe',
        'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd',
      ]),
    ).toEqual([
      ['uvcs', 'C:\\Program Files\\PlasticSCM5\\client\\plastic.exe'],
      ['vscode', 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd'],
      ['rider', 'C:\\Program Files\\JetBrains\\JetBrains Rider 2026.2\\bin\\rider64.exe'],
    ]);
  });

  it('finds the Windows tools where their installers put them', () => {
    expect(
      found(windows, [
        'C:\\Program Files\\KDiff3\\bin\\kdiff3.exe',
        'C:\\Program Files\\WinMerge\\WinMergeU.exe',
        'C:\\Users\\me\\AppData\\Local\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd',
        'C:\\Program Files (x86)\\Beyond Compare 4\\BComp.exe',
      ]),
    ).toEqual([
      ['cursor', 'C:\\Users\\me\\AppData\\Local\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd'],
      ['kdiff3', 'C:\\Program Files\\KDiff3\\bin\\kdiff3.exe'],
      ['bcompare', 'C:\\Program Files (x86)\\Beyond Compare 4\\BComp.exe'],
      ['winmerge', 'C:\\Program Files\\WinMerge\\WinMergeU.exe'],
    ]);
  });

  it('finds Linux tools on the PATH, and VS Code where its package installs it when the PATH is short', () => {
    const linux: Whereabouts = { platform: 'linux', env: { PATH: '/usr/bin:/bin' }, home: '/home/me', cmPath: '/usr/bin/cm' };
    expect(found(linux, ['/usr/bin/plasticgui', '/usr/bin/meld', '/usr/bin/kdiff3', '/usr/share/code/bin/code', '/usr/bin/bcompare'])).toEqual([
      ['uvcs', '/usr/bin/plasticgui'],
      ['vscode', '/usr/share/code/bin/code'],
      ['kdiff3', '/usr/bin/kdiff3'],
      ['bcompare', '/usr/bin/bcompare'],
      ['meld', '/usr/bin/meld'],
    ]);
  });

  it("finds the UVCS merge tool as the Linux package installs it, next to cm, when cm isn't the /usr/bin link", () => {
    const linux: Whereabouts = { platform: 'linux', env: { PATH: '/home/me/bin' }, home: '/home/me', cmPath: '/opt/plasticscm5/client/cm' };
    expect(found(linux, ['/usr/bin/plasticgui', '/opt/plasticscm5/client/linplasticx'])).toEqual([['uvcs', '/opt/plasticscm5/client/linplasticx']]);
  });
});
