import { describe, expect, it } from 'vitest';
import type { AppFileSystem } from './appFileSystem';
import { findEditor, KNOWN_EDITORS } from './editors';
import { NO_INSTALLED_APPS, type InstalledApps } from './installedApps';
import { fakeFileSystem, installedOnMac, installedOnWindows, linux, mac, windows } from './testing/appFixtures';
import type { Whereabouts } from './whereabouts';

/** Each editor found, with where it is and how it opens `path`. */
function found(where: Whereabouts, installed: InstalledApps, fs: AppFileSystem, path = '/wk/a.cs') {
  return KNOWN_EDITORS.flatMap((editor) => {
    const editorFound = findEditor(editor, where, installed, fs);
    return editorFound ? [{ id: editor.id, location: editorFound.location, launch: editorFound.launch(path) }] : [];
  });
}

describe('editors on macOS', () => {
  it('finds apps by bundle identifier wherever they are installed, and opens a path with `open -a`', () => {
    const installed = installedOnMac({ 'com.microsoft.VSCode': '/Applications/Visual Studio Code.app', 'com.jetbrains.rider': '/Users/me/Tools/Rider.app' });
    expect(found(mac, installed, fakeFileSystem([]))).toEqual([
      { id: 'vscode', location: '/Applications/Visual Studio Code.app', launch: { command: 'open', args: ['-a', '/Applications/Visual Studio Code.app', '/wk/a.cs'], exits: true } },
      { id: 'rider', location: '/Users/me/Tools/Rider.app', launch: { command: 'open', args: ['-a', '/Users/me/Tools/Rider.app', '/wk/a.cs'], exits: true } },
    ]);
  });

  it("finds them in /Applications and ~/Applications when Spotlight doesn't answer, any edition", () => {
    const fs = fakeFileSystem(['/Applications/Zed.app', '/Users/me/Applications/IntelliJ IDEA CE.app', '/Applications/Xcode.app']);
    expect(found(mac, NO_INSTALLED_APPS, fs).map(({ id, location }) => [id, location])).toEqual([
      ['zed', '/Applications/Zed.app'],
      ['intellij', '/Users/me/Applications/IntelliJ IDEA CE.app'],
      ['xcode', '/Applications/Xcode.app'],
    ]);
  });
});

describe('editors on Windows', () => {
  it('finds apps by their uninstall entry and runs their program in the install folder', () => {
    const installed = installedOnWindows([
      { displayName: 'Microsoft Visual Studio Code (User)', publisher: 'Microsoft Corporation', installLocation: 'D:\\Apps\\VS Code\\' },
      { displayName: 'JetBrains Rider 2026.2', publisher: 'JetBrains s.r.o.', installLocation: 'D:\\JetBrains\\Rider' },
      { displayName: 'Visual Studio Community 2022', publisher: 'Microsoft Corporation', installLocation: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community' },
    ]);
    const fs = fakeFileSystem(['D:\\Apps\\VS Code\\Code.exe', 'D:\\JetBrains\\Rider\\bin\\rider64.exe', 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\devenv.exe']);
    expect(found(windows, installed, fs, 'C:\\wk\\R&D\\a.cs')).toEqual([
      { id: 'vscode', location: 'D:\\Apps\\VS Code\\Code.exe', launch: { command: 'D:\\Apps\\VS Code\\Code.exe', args: ['C:\\wk\\R&D\\a.cs'], exits: false } },
      { id: 'rider', location: 'D:\\JetBrains\\Rider\\bin\\rider64.exe', launch: { command: 'D:\\JetBrains\\Rider\\bin\\rider64.exe', args: ['C:\\wk\\R&D\\a.cs'], exits: false } },
      {
        id: 'visualStudio',
        location: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\devenv.exe',
        launch: { command: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\devenv.exe', args: ['C:\\wk\\R&D\\a.cs'], exits: false },
      },
    ]);
  });

  it("tells apps apart by their program, and by their publisher, when display names start alike", () => {
    const installed = installedOnWindows([
      { displayName: 'Microsoft Visual Studio Code Insiders', publisher: 'Microsoft Corporation', installLocation: 'C:\\Insiders' },
      { displayName: 'Visual Studio Build Tools 2022', publisher: 'Microsoft Corporation', installLocation: 'C:\\BuildTools' },
      { displayName: 'Cursor', publisher: 'Someone Else', installLocation: 'C:\\NotCursor' },
    ]);
    const fs = fakeFileSystem(['C:\\Insiders\\Code - Insiders.exe', 'C:\\NotCursor\\Cursor.exe']);
    expect(found(windows, installed, fs).map(({ id }) => id)).toEqual(['vscodeInsiders']);
  });

  it('finds an app its installer put in the usual folder without an entry, then a launcher on the PATH', () => {
    const fs = fakeFileSystem(['C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', 'C:\\Windows\\windsurf.cmd']);
    const editors = found(windows, NO_INSTALLED_APPS, fs, 'C:\\wk\\a.cs');
    expect(editors.map(({ id, location }) => [id, location])).toEqual([
      ['vscode', 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'],
      ['windsurf', 'C:\\Windows\\windsurf.cmd'],
    ]);
    expect(editors[1]!.launch).toMatchObject({ command: 'cmd.exe', verbatim: true });
  });
});

describe('editors on Linux', () => {
  it("runs the desktop entry's command line, from a package, a Flatpak or a Snap", () => {
    const fs = fakeFileSystem(['/usr/share/code/code', '/usr/bin/flatpak'], {
      '/usr/share/applications/code.desktop': '[Desktop Entry]\nExec=/usr/share/code/code %F\n',
      '/var/lib/flatpak/exports/share/applications/dev.zed.Zed.desktop': '[Desktop Entry]\nExec=/usr/bin/flatpak run dev.zed.Zed --file-forwarding @@ %F @@\n',
    });
    expect(found(linux, NO_INSTALLED_APPS, fs, '/wk/my game')).toEqual([
      { id: 'vscode', location: '/usr/share/applications/code.desktop', launch: { command: '/usr/share/code/code', args: ['/wk/my game'], exits: false } },
      {
        id: 'zed',
        location: '/var/lib/flatpak/exports/share/applications/dev.zed.Zed.desktop',
        launch: { command: '/usr/bin/flatpak', args: ['run', 'dev.zed.Zed', '--file-forwarding', '@@', '/wk/my game', '@@'], exits: false },
      },
    ]);
  });

  it('finds editors without a desktop entry on the PATH, and JetBrains Toolbox scripts in the home folder', () => {
    const fs = fakeFileSystem(['/usr/bin/subl', '/home/me/.local/share/JetBrains/Toolbox/scripts/rider']);
    expect(found(linux, NO_INSTALLED_APPS, fs).map(({ id, launch }) => [id, launch.command])).toEqual([
      ['sublimeText', '/usr/bin/subl'],
      ['rider', '/home/me/.local/share/JetBrains/Toolbox/scripts/rider'],
    ]);
  });
});
