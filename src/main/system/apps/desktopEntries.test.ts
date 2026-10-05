import { describe, expect, it } from 'vitest';
import { applicationFolders, execArgsFor, findDesktopEntry, parseDesktopEntry, splitExec } from './desktopEntries';
import type { Whereabouts } from './whereabouts';

const linux: Whereabouts = { platform: 'linux', env: { PATH: '/usr/bin:/bin' }, home: '/home/me', cmPath: '/usr/bin/cm' };

function files(contents: Record<string, string>, programs: string[] = []) {
  return {
    exists: (path: string) => programs.includes(path),
    list: () => [],
    read: (path: string) => contents[path] ?? null,
  };
}

describe('applicationFolders', () => {
  it("looks in the user's folder, then the system's, then the Flatpak and Snap exports", () => {
    expect(applicationFolders(linux)).toEqual([
      '/home/me/.local/share/applications',
      '/usr/local/share/applications',
      '/usr/share/applications',
      '/home/me/.local/share/flatpak/exports/share/applications',
      '/var/lib/flatpak/exports/share/applications',
      '/var/lib/snapd/desktop/applications',
    ]);
  });

  it('follows $XDG_DATA_HOME and $XDG_DATA_DIRS, each folder once', () => {
    const where = { ...linux, env: { XDG_DATA_HOME: '/data/me', XDG_DATA_DIRS: '/var/lib/flatpak/exports/share:/usr/share' } };
    expect(applicationFolders(where)).toEqual([
      '/data/me/applications',
      '/var/lib/flatpak/exports/share/applications',
      '/usr/share/applications',
      '/home/me/.local/share/flatpak/exports/share/applications',
      '/var/lib/snapd/desktop/applications',
    ]);
  });
});

describe('parseDesktopEntry', () => {
  it("reads the main group's command line, not an action's", () => {
    const text = ['[Desktop Entry]', 'Name=Visual Studio Code', 'Exec=/usr/share/code/code %F', 'Type=Application', '', '[Desktop Action new-empty-window]', 'Exec=/usr/share/code/code --new-window'].join('\n');
    expect(parseDesktopEntry(text)).toEqual({ exec: ['/usr/share/code/code', '%F'] });
  });

  it('has nothing for hidden entries, links and entries that run nothing', () => {
    expect(parseDesktopEntry('[Desktop Entry]\nExec=code\nHidden=true')).toBeNull();
    expect(parseDesktopEntry('[Desktop Entry]\nType=Link\nURL=https://example.com')).toBeNull();
    expect(parseDesktopEntry('[Desktop Entry]\nName=Broken')).toBeNull();
  });
});

describe('splitExec', () => {
  it('splits on spaces and keeps quoted arguments whole, with their escapes', () => {
    expect(splitExec('flatpak run --branch=stable --command=code com.visualstudio.code --file-forwarding @@ %F @@')).toEqual([
      'flatpak', 'run', '--branch=stable', '--command=code', 'com.visualstudio.code', '--file-forwarding', '@@', '%F', '@@',
    ]);
    expect(splitExec('"/opt/My Editor/editor" --title "say \\"hi\\"" %f')).toEqual(['/opt/My Editor/editor', '--title', 'say "hi"', '%f']);
  });

  it("undoes the string's own escapes first, so a space from `\\s` splits too unless quoted", () => {
    expect(splitExec('/opt/editor\\sbin/run %U')).toEqual(['/opt/editor', 'bin/run', '%U']);
    expect(splitExec('"/opt/editor\\sbin/run" %U')).toEqual(['/opt/editor bin/run', '%U']);
  });
});

describe('execArgsFor', () => {
  it('puts the path where the entry takes a file, and drops the other field codes', () => {
    expect(execArgsFor(['/usr/share/code/code', '%F'], '/wk/game/a b.cs')).toEqual(['/usr/share/code/code', '/wk/game/a b.cs']);
    expect(execArgsFor(['kate', '-b', '%U', '%i', '%c'], '/wk/a.cs')).toEqual(['kate', '-b', '/wk/a.cs']);
    expect(execArgsFor(['flatpak', 'run', 'org.x', '@@', '%F', '@@'], '/wk')).toEqual(['flatpak', 'run', 'org.x', '@@', '/wk', '@@']);
  });

  it("adds the path at the end of an entry that takes no file, and keeps a percent sign", () => {
    expect(execArgsFor(['editor', '--zoom=100%%'], '/wk/a.cs')).toEqual(['editor', '--zoom=100%', '/wk/a.cs']);
  });
});

describe('findDesktopEntry', () => {
  const vscode = '[Desktop Entry]\nExec=/usr/share/code/code %F\n';
  const flatpak = '[Desktop Entry]\nExec=/usr/bin/flatpak run com.visualstudio.code %F\n';

  it('finds the first id installed, in the first folder holding it', () => {
    const fs = files({ '/var/lib/flatpak/exports/share/applications/com.visualstudio.code.desktop': flatpak }, ['/usr/bin/flatpak']);
    expect(findDesktopEntry(['code.desktop', 'com.visualstudio.code.desktop'], linux, fs)).toEqual({
      file: '/var/lib/flatpak/exports/share/applications/com.visualstudio.code.desktop',
      exec: ['/usr/bin/flatpak', 'run', 'com.visualstudio.code', '%F'],
    });
  });

  it("lets the user's hidden copy hide the system's entry", () => {
    const fs = files({ '/home/me/.local/share/applications/code.desktop': '[Desktop Entry]\nHidden=true\n', '/usr/share/applications/code.desktop': vscode }, ['/usr/share/code/code']);
    expect(findDesktopEntry(['code.desktop'], linux, fs)).toBeUndefined();
  });

  it('skips an entry whose program, or TryExec, is gone', () => {
    expect(findDesktopEntry(['code.desktop'], linux, files({ '/usr/share/applications/code.desktop': vscode }))).toBeUndefined();
    const tryExec = '[Desktop Entry]\nTryExec=zed\nExec=sh -c zed\n';
    expect(findDesktopEntry(['zed.desktop'], linux, files({ '/usr/share/applications/zed.desktop': tryExec }, ['/usr/bin/sh']))).toBeUndefined();
    expect(findDesktopEntry(['zed.desktop'], linux, files({ '/usr/share/applications/zed.desktop': tryExec }, ['/usr/bin/sh', '/usr/bin/zed']))?.exec).toEqual(['sh', '-c', 'zed']);
  });
});
