import { posix, win32 } from 'node:path';
import { APP_IDENTITIES } from './appIdentities';
import { locateInstall, programInInstall, type AppIdentity } from './appIdentity';
import type { AppFileSystem } from './appFileSystem';
import { execArgsFor } from './desktopEntries';
import { findFirst, findOnPath } from './findProgram';
import type { InstalledApps } from './installedApps';
import { macOpen, runProgram, type LaunchCommand } from './launchCommand';
import { localPrograms, programFiles, type Whereabouts } from './whereabouts';

/** An app files and folders open in ("Open with"), found by its identity, else where it's usually installed. */
export interface KnownEditor {
  id: string;
  name: string;
  identity: AppIdentity;
  /** Its program in its Windows install folder, the first that exists. */
  windowsPrograms: string[];
  /** Where it may be when its OS has no record of it (an installer that doesn't register, a launcher script). */
  locations?: (where: Whereabouts) => string[];
  /** Its names on the PATH, for an editor installed as a command (`subl`, a Toolbox script). */
  commands?: Partial<Record<NodeJS.Platform, string[]>>;
  /** It opens a folder as a project; a plain text editor would open every file in it, or nothing. */
  opensFolders: boolean;
}

/** An editor found here: where (shown in Settings) and how it opens a path. */
export interface FoundEditor {
  editor: KnownEditor;
  location: string;
  launch: (path: string) => LaunchCommand;
}

function vscodeLike(id: string, name: string, identity: AppIdentity, windowsFolder: string, program: string, command: string): KnownEditor {
  const windowsProgram = `${windowsFolder}\\${program}`;
  return {
    id,
    name,
    identity,
    windowsPrograms: [program],
    locations: (where) => (where.platform === 'win32' ? [...localPrograms(where, windowsProgram), ...programFiles(where, windowsProgram)] : []),
    commands: { linux: [command], win32: [`${command}.cmd`] },
    opensFolders: true,
  };
}

function jetbrains(id: string, name: string, identity: AppIdentity, command: string): KnownEditor {
  return {
    id,
    name,
    identity,
    windowsPrograms: [`bin\\${command}64.exe`, `bin\\${command}.exe`],
    locations: (where) => {
      if (where.platform === 'win32') return where.env.LOCALAPPDATA ? [win32.join(where.env.LOCALAPPDATA, 'JetBrains', 'Toolbox', 'scripts', `${command}.cmd`)] : [];
      if (where.platform === 'linux') return [posix.join(where.home, '.local/share/JetBrains/Toolbox/scripts', command)];
      return [];
    },
    commands: { linux: [command, `${command}.sh`] },
    opensFolders: true,
  };
}

const plain = (id: string, name: string, identity: AppIdentity, windowsPrograms: string[], opensFolders: boolean, commands?: KnownEditor['commands']): KnownEditor => ({
  id,
  name,
  identity,
  windowsPrograms,
  opensFolders,
  ...(commands && { commands }),
});

/** The editors looked for, in the order "Automatic" picks the first found (and the order they're listed). */
export const KNOWN_EDITORS: KnownEditor[] = [
  vscodeLike('vscode', 'Visual Studio Code', APP_IDENTITIES.vscode, 'Microsoft VS Code', 'Code.exe', 'code'),
  vscodeLike('cursor', 'Cursor', APP_IDENTITIES.cursor, 'cursor', 'Cursor.exe', 'cursor'),
  vscodeLike('windsurf', 'Windsurf', APP_IDENTITIES.windsurf, 'Windsurf', 'Windsurf.exe', 'windsurf'),
  plain('zed', 'Zed', APP_IDENTITIES.zed, ['Zed.exe'], true, { linux: ['zed', 'zeditor'] }),
  vscodeLike('vscodeInsiders', 'VS Code Insiders', APP_IDENTITIES.vscodeInsiders, 'Microsoft VS Code Insiders', 'Code - Insiders.exe', 'code-insiders'),
  vscodeLike('vscodium', 'VSCodium', APP_IDENTITIES.vscodium, 'VSCodium', 'VSCodium.exe', 'codium'),
  plain('sublimeText', 'Sublime Text', APP_IDENTITIES.sublimeText, ['sublime_text.exe'], true, { linux: ['subl'] }),
  jetbrains('rider', 'JetBrains Rider', APP_IDENTITIES.rider, 'rider'),
  plain('visualStudio', 'Visual Studio', APP_IDENTITIES.visualStudio, ['Common7\\IDE\\devenv.exe'], true),
  jetbrains('intellij', 'IntelliJ IDEA', APP_IDENTITIES.intellij, 'idea'),
  jetbrains('webstorm', 'WebStorm', APP_IDENTITIES.webstorm, 'webstorm'),
  jetbrains('pycharm', 'PyCharm', APP_IDENTITIES.pycharm, 'pycharm'),
  jetbrains('clion', 'CLion', APP_IDENTITIES.clion, 'clion'),
  jetbrains('goland', 'GoLand', APP_IDENTITIES.goland, 'goland'),
  jetbrains('phpstorm', 'PhpStorm', APP_IDENTITIES.phpstorm, 'phpstorm'),
  jetbrains('rustrover', 'RustRover', APP_IDENTITIES.rustrover, 'rustrover'),
  plain('androidStudio', 'Android Studio', APP_IDENTITIES.androidStudio, ['bin\\studio64.exe'], true),
  plain('xcode', 'Xcode', APP_IDENTITIES.xcode, [], true),
  plain('bbedit', 'BBEdit', APP_IDENTITIES.bbedit, [], true),
  plain('nova', 'Nova', APP_IDENTITIES.nova, [], true),
  plain('notepadPlusPlus', 'Notepad++', APP_IDENTITIES.notepadPlusPlus, ['notepad++.exe'], false),
  plain('kate', 'Kate', APP_IDENTITIES.kate, [], true, { linux: ['kate'] }),
  plain('gnomeTextEditor', 'Text Editor', APP_IDENTITIES.gnomeTextEditor, [], false, { linux: ['gnome-text-editor'] }),
  plain('gedit', 'gedit', APP_IDENTITIES.gedit, [], false, { linux: ['gedit'] }),
];

/**
 * Where the editor is here and how it opens a path, or undefined. macOS opens its bundle (`open -a`); Windows runs its
 * program in the install folder its uninstall entry names; Linux runs its desktop entry's command line. Then its usual
 * locations and the PATH, for installs the OS has no record of.
 */
export function findEditor(editor: KnownEditor, where: Whereabouts, installed: InstalledApps, fs: AppFileSystem): FoundEditor | undefined {
  const install = where.platform === 'win32' ? undefined : locateInstall(editor.identity, where, installed, fs);
  if (install?.kind === 'macBundle') return { editor, location: install.bundle, launch: (path) => macOpen(install.bundle, path) };
  if (install?.kind === 'desktopEntry') {
    const [command, ...args] = install.entry.exec;
    return { editor, location: install.entry.file, launch: (path) => ({ command: command!, args: execArgsFor(args, path), exits: false }) };
  }
  if (where.platform === 'darwin') return undefined;

  const program =
    (where.platform === 'win32' ? programInInstall(editor.identity, editor.windowsPrograms, where, installed, fs) : undefined) ??
    findFirst(editor.locations?.(where) ?? [], where, fs) ??
    findOnPath(editor.commands?.[where.platform] ?? [], where, fs);
  return program ? { editor, location: program, launch: (path) => runProgram(where.platform, program, [path]) } : undefined;
}
