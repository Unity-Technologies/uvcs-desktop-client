import { describe, expect, it } from 'vitest';
import { appExecutable } from './appExecutable';
import { commandLine } from './launch';
import { KNOWN_TOOLS } from './knownTools';
import { appBundleOf, mergeToolList, type MergeToolSources } from './mergeToolList';

const known = (id: string, executable: string) => ({ tool: KNOWN_TOOLS.find((tool) => tool.id === id)!, executable });

const sources: MergeToolSources = {
  detected: [known('uvcs', '/Applications/PlasticSCM.app/Contents/MacOS/macplasticx'), known('vscode', '/usr/local/bin/code')],
  clientConf: [{ executable: 'UnityYAMLMerge', found: '/opt/UnityYAMLMerge', args: ['merge', '{base}'], extensions: ['.unity'] }],
  custom: [{ id: 'custom:1', name: 'My tool', executable: '/opt/mytool', args: ['{base}', '{result}'] }],
  argsOverrides: { vscode: ['--wait', '{result}'] },
  preference: 'auto',
  platform: 'darwin',
};

describe('mergeToolList', () => {
  it('lists the UVCS tool first, then client.conf, the other tools found and the user’s', () => {
    const { tools } = mergeToolList(sources);
    expect(tools.map((tool) => [tool.id, tool.name])).toEqual([
      ['uvcs', 'UVCS merge tool'],
      ['clientConf:0', 'UnityYAMLMerge (client.conf, .unity)'],
      ['vscode', 'Visual Studio Code'],
      ['custom:1', 'My tool'],
    ]);
    expect(tools[0]).toMatchObject({ canBringToFront: true, extensions: null });
    expect(tools[2]).toMatchObject({ args: ['--wait', '{result}'], defaultArgs: KNOWN_TOOLS[1]!.args, canBringToFront: false });
  });

  it('prefers the user’s pick while it is there, else the UVCS tool, else the first for every file', () => {
    expect(mergeToolList(sources).preferredId).toBe('uvcs');
    expect(mergeToolList({ ...sources, preference: 'custom:1' }).preferredId).toBe('custom:1');
    expect(mergeToolList({ ...sources, preference: 'gone' }).preferredId).toBe('uvcs');
    expect(mergeToolList({ ...sources, detected: [] }).preferredId).toBe('custom:1');
    expect(mergeToolList({ ...sources, detected: [], custom: [], clientConf: [] }).preferredId).toBeNull();
  });
});

describe('appBundleOf', () => {
  it('finds the app a program is in', () => {
    expect(appBundleOf('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')).toBe('/Applications/Visual Studio Code.app');
    expect(appBundleOf('/usr/bin/opendiff')).toBeNull();
  });
});

describe('appExecutable', () => {
  const fs = (files: Record<string, string>) => ({
    exists: (path: string) => path in files,
    list: (folder: string) => Object.keys(files).filter((path) => path.startsWith(`${folder}/`)).map((path) => path.slice(folder.length + 1)),
    read: (path: string) => files[path] ?? null,
  });

  it('runs a macOS app’s declared program', () => {
    const plist = '<plist><dict><key>CFBundleExecutable</key>\n<string>p4merge</string></dict></plist>';
    expect(appExecutable('/Applications/P4.app', fs({ '/Applications/P4.app/Contents/Info.plist': plist, '/Applications/P4.app/Contents/MacOS/p4merge': '' }))).toBe(
      '/Applications/P4.app/Contents/MacOS/p4merge',
    );
  });

  it('falls back to the program named like the app, and takes other programs as they are', () => {
    expect(appExecutable('/Applications/Tool.app/', fs({ '/Applications/Tool.app/Contents/MacOS/Tool': '' }))).toBe('/Applications/Tool.app/Contents/MacOS/Tool');
    expect(appExecutable('/usr/local/bin/tool', fs({}))).toBe('/usr/local/bin/tool');
  });
});

describe('commandLine', () => {
  it('runs programs directly, and Windows .cmd launchers through cmd.exe with every argument quoted', () => {
    expect(commandLine('darwin', '/bin/tool', ['a b'])).toEqual({ command: '/bin/tool', commandArgs: ['a b'], verbatim: false });
    expect(commandLine('win32', 'C:\\VS Code\\bin\\code.cmd', ['--wait', 'C:\\t\\a&b "x".ts'])).toEqual({
      command: 'cmd.exe',
      commandArgs: ['/d', '/s', '/c', '""C:\\VS Code\\bin\\code.cmd" "--wait" "C:\\t\\ab x.ts""'],
      verbatim: true,
    });
  });
});
