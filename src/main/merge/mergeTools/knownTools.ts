import { posix, win32 } from 'node:path';

/**
 * The merge tools the app looks for, each with its three-way command line as its documentation (and Git's own
 * `mergetools/*` definitions) give it. Placeholders are filled per file by `fillArgs`.
 */
export interface KnownTool {
  id: string;
  name: string;
  /** `{result}` is where the tool saves. */
  args: string[];
  /** Where it may be installed, in order; a `*` stands for any name in one folder (a version number). */
  locations: (where: Whereabouts) => string[];
  /** Program names to look for on the PATH. */
  commands: Partial<Record<NodeJS.Platform, string[]>>;
  /** Found only if one of these exists too, for launchers that are there without the tool (`opendiff` without Xcode). */
  requires?: (where: Whereabouts) => string[];
}

/** What locating a tool depends on. */
export interface Whereabouts {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
  /** Where `cm` was found: the UVCS merge tool lives next to it on Windows. */
  cmPath: string;
}

/**
 * The UVCS merge tool is the Desktop GUI run with `xmerge` (`DiffMergeToolConfig.cs`). It
 * saves to `-r` and exits 0 only when it saved. Source is the incoming side, destination yours. No `-a`: it would
 * close by itself when nothing needs the user.
 */
const UVCS_SIDES = ['-b={base}', '-bn={baseName}', '-s={incoming}', '-sn={incomingName}', '-d={yours}', '-dn={yoursName}', '-r={result}'];

/** VS Code and its forks: the first file is the incoming side, the second yours (Git's `mergetools/vscode`). */
const VSCODE_ARGS = ['--wait', '--merge', '{incoming}', '{yours}', '{base}', '{result}'];

/** `idea merge <path1> <path2> <base> <output>`, the same for every JetBrains IDE; path1 shows on the left. */
const JETBRAINS_ARGS = ['merge', '{yours}', '{incoming}', '{base}', '{result}'];

const macApps = (where: Whereabouts, bundlePath: string): string[] =>
  ['/Applications', posix.join(where.home, 'Applications')].map((folder) => posix.join(folder, bundlePath));

const programFiles = (where: Whereabouts, path: string): string[] =>
  [where.env.ProgramFiles ?? 'C:\\Program Files', where.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'].map((folder) => win32.join(folder, path));

const localPrograms = (where: Whereabouts, path: string): string[] =>
  where.env.LOCALAPPDATA ? [win32.join(where.env.LOCALAPPDATA, 'Programs', path)] : [];

function vscodeLike(id: string, name: string, app: string, command: string, windowsFolder: string): KnownTool {
  return {
    id,
    name,
    args: VSCODE_ARGS,
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, `${app}.app/Contents/Resources/app/bin/${command}`);
      if (where.platform === 'win32') return [...localPrograms(where, `${windowsFolder}\\bin\\${command}.cmd`), ...programFiles(where, `${windowsFolder}\\bin\\${command}.cmd`)];
      return [];
    },
    commands: { darwin: [command], linux: [command], win32: [`${command}.cmd`] },
  };
}

function jetbrains(id: string, name: string, apps: string[], command: string, windowsFolder: string): KnownTool {
  return {
    id,
    name,
    args: JETBRAINS_ARGS,
    locations: (where) => {
      if (where.platform === 'darwin') return apps.flatMap((app) => macApps(where, `${app}.app/Contents/MacOS/${command}`));
      if (where.platform === 'win32') {
        return [
          ...programFiles(where, `JetBrains\\${windowsFolder} *\\bin\\${command}64.exe`),
          ...localPrograms(where, `${windowsFolder}\\bin\\${command}64.exe`),
          ...(where.env.LOCALAPPDATA ? [win32.join(where.env.LOCALAPPDATA, 'JetBrains', 'Toolbox', 'scripts', `${command}.cmd`)] : []),
        ];
      }
      return [posix.join(where.home, '.local/share/JetBrains/Toolbox/scripts', command)];
    },
    commands: { darwin: [command], linux: [command, `${command}.sh`] },
  };
}

export const UVCS_TOOL_ID = 'uvcs';

export const KNOWN_TOOLS: KnownTool[] = [
  {
    id: UVCS_TOOL_ID,
    name: 'UVCS merge tool',
    args: ['xmerge', ...UVCS_SIDES],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'PlasticSCM.app/Contents/MacOS/macplasticx');
      if (where.platform === 'win32') {
        return [
          win32.join(win32.dirname(where.cmPath), 'plastic.exe'),
          ...programFiles(where, 'PlasticSCM5\\client\\plastic.exe'),
          ...programFiles(where, 'Unity VCS\\client\\plastic.exe'),
        ];
      }
      return [posix.join(posix.dirname(where.cmPath), 'plasticgui'), '/opt/plasticscm5/client/plasticgui'];
    },
    commands: { darwin: ['plasticgui'], linux: ['plasticgui'], win32: ['plastic.exe'] },
  },
  vscodeLike('vscode', 'Visual Studio Code', 'Visual Studio Code', 'code', 'Microsoft VS Code'),
  vscodeLike('vscodeInsiders', 'VS Code Insiders', 'Visual Studio Code - Insiders', 'code-insiders', 'Microsoft VS Code Insiders'),
  vscodeLike('cursor', 'Cursor', 'Cursor', 'cursor', 'cursor'),
  vscodeLike('windsurf', 'Windsurf', 'Windsurf', 'windsurf', 'Windsurf'),
  jetbrains('rider', 'JetBrains Rider', ['Rider'], 'rider', 'JetBrains Rider'),
  jetbrains('intellij', 'IntelliJ IDEA', ['IntelliJ IDEA', 'IntelliJ IDEA Ultimate', 'IntelliJ IDEA CE'], 'idea', 'IntelliJ IDEA'),
  jetbrains('webstorm', 'WebStorm', ['WebStorm'], 'webstorm', 'WebStorm'),
  jetbrains('pycharm', 'PyCharm', ['PyCharm', 'PyCharm Professional Edition', 'PyCharm CE'], 'pycharm', 'PyCharm'),
  jetbrains('clion', 'CLion', ['CLion'], 'clion', 'CLion'),
  jetbrains('goland', 'GoLand', ['GoLand'], 'goland', 'GoLand'),
  {
    id: 'smerge',
    name: 'Sublime Merge',
    args: ['mergetool', '{base}', '{yours}', '{incoming}', '-o', '{result}'],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'Sublime Merge.app/Contents/SharedSupport/bin/smerge');
      if (where.platform === 'win32') return programFiles(where, 'Sublime Merge\\smerge.exe');
      return ['/opt/sublime_merge/sublime_merge'];
    },
    commands: { darwin: ['smerge'], linux: ['smerge'], win32: ['smerge.exe'] },
  },
  {
    id: 'kdiff3',
    name: 'KDiff3',
    args: ['{base}', '{yours}', '{incoming}', '-o', '{result}', '--L1', '{baseName}', '--L2', '{yoursName}', '--L3', '{incomingName}'],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'kdiff3.app/Contents/MacOS/kdiff3');
      if (where.platform === 'win32') return programFiles(where, 'KDiff3\\kdiff3.exe');
      return [];
    },
    commands: { darwin: ['kdiff3'], linux: ['kdiff3'], win32: ['kdiff3.exe'] },
  },
  {
    id: 'bcompare',
    name: 'Beyond Compare',
    args: ['{yours}', '{incoming}', '{base}', '{result}'],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'Beyond Compare.app/Contents/MacOS/bcomp');
      if (where.platform === 'win32') return [...programFiles(where, 'Beyond Compare 5\\BComp.exe'), ...programFiles(where, 'Beyond Compare 4\\BComp.exe')];
      return [];
    },
    commands: { darwin: ['bcomp'], linux: ['bcompare', 'bcomp'], win32: ['BComp.exe'] },
  },
  {
    id: 'meld',
    name: 'Meld',
    args: ['--output={result}', '{yours}', '{base}', '{incoming}'],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'Meld.app/Contents/MacOS/Meld');
      if (where.platform === 'win32') return programFiles(where, 'Meld\\Meld.exe');
      return [];
    },
    commands: { darwin: ['meld'], linux: ['meld'], win32: ['Meld.exe'] },
  },
  {
    id: 'p4merge',
    name: 'P4Merge',
    args: ['{base}', '{incoming}', '{yours}', '{result}'],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'p4merge.app/Contents/MacOS/p4merge');
      if (where.platform === 'win32') return programFiles(where, 'Perforce\\p4merge.exe');
      return [];
    },
    commands: { darwin: ['p4merge'], linux: ['p4merge'], win32: ['p4merge.exe'] },
  },
  {
    id: 'araxis',
    name: 'Araxis Merge',
    args: ['-wait', '-merge', '-3', '-a1', '{base}', '{yours}', '{incoming}', '{result}'],
    locations: (where) => {
      if (where.platform === 'darwin') return macApps(where, 'Araxis Merge.app/Contents/Utilities/compare');
      if (where.platform === 'win32') return programFiles(where, 'Araxis\\Araxis Merge\\compare.exe');
      return [];
    },
    commands: {},
  },
  {
    // `opendiff` returns at once unless its output is a pipe, which it is for the app (Git pipes it to `cat`).
    id: 'opendiff',
    name: 'FileMerge',
    args: ['{yours}', '{incoming}', '-ancestor', '{base}', '-merge', '{result}'],
    locations: (where) => (where.platform === 'darwin' ? ['/usr/bin/opendiff'] : []),
    commands: {},
    requires: (where) => macApps(where, 'Xcode.app/Contents/Applications/FileMerge.app'),
  },
];
