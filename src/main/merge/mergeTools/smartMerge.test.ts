import { describe, expect, it } from 'vitest';
import { fakeFileSystem, linux, mac, windows } from '../../system/apps/testing/appFixtures';
import { fillArgs } from './commandLine';
import { findSmartMerge, judgeSmartMerge, SMART_MERGE_ARGS, smartMergeWentWrong } from './smartMerge';

const MAC_HUB = '/Applications/Unity/Hub/Editor';

describe('findSmartMerge', () => {
  it('finds it in the newest Unity release on macOS, in Helpers since Unity 6.3 and in Tools before', () => {
    const fs = fakeFileSystem([
      `${MAC_HUB}/2022.3.62f3/Unity.app/Contents/Tools/UnityYAMLMerge`,
      `${MAC_HUB}/6000.3.19f1/Unity.app/Contents/Helpers/UnityYAMLMerge`,
      `${MAC_HUB}/6000.7.0a2/Unity.app/Contents/Helpers/UnityYAMLMerge`,
    ]);
    expect(findSmartMerge(mac, fs)).toEqual({ executable: `${MAC_HUB}/6000.3.19f1/Unity.app/Contents/Helpers/UnityYAMLMerge`, editorVersion: '6000.3.19f1' });
    expect(findSmartMerge(mac, fakeFileSystem([`${MAC_HUB}/2022.3.62f3/Unity.app/Contents/Tools/UnityYAMLMerge`]))).toEqual({
      executable: `${MAC_HUB}/2022.3.62f3/Unity.app/Contents/Tools/UnityYAMLMerge`,
      editorVersion: '2022.3.62f3',
    });
  });

  it('finds it in Data\\Tools on Windows and Data/Tools on Linux', () => {
    const windowsFs = fakeFileSystem([
      'C:\\Program Files\\Unity\\Hub\\Editor\\2021.3.45f2\\Editor\\Data\\Tools\\UnityYAMLMerge.exe',
      'C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.77f1\\Editor\\Data\\Tools\\UnityYAMLMerge.exe',
    ]);
    expect(findSmartMerge(windows, windowsFs)).toEqual({
      executable: 'C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.77f1\\Editor\\Data\\Tools\\UnityYAMLMerge.exe',
      editorVersion: '6000.0.77f1',
    });

    const linuxFs = fakeFileSystem(['/home/me/Unity/Hub/Editor/6000.0.77f1/Editor/Data/Tools/UnityYAMLMerge']);
    expect(findSmartMerge(linux, linuxFs)).toEqual({ executable: '/home/me/Unity/Hub/Editor/6000.0.77f1/Editor/Data/Tools/UnityYAMLMerge', editorVersion: '6000.0.77f1' });
  });

  it('skips a newer editor that lacks it, and falls back to an alpha, then to the editor installed before the Hub', () => {
    const fs = fakeFileSystem([`${MAC_HUB}/6000.3.19f1/Unity.app`, `${MAC_HUB}/6000.7.0a2/Unity.app/Contents/Helpers/UnityYAMLMerge`]);
    expect(findSmartMerge(mac, fs)?.editorVersion).toBe('6000.7.0a2');
    expect(findSmartMerge(mac, fakeFileSystem(['/Applications/Unity/Unity.app/Contents/Tools/UnityYAMLMerge']))).toEqual({
      executable: '/Applications/Unity/Unity.app/Contents/Tools/UnityYAMLMerge',
      editorVersion: '',
    });
  });

  it('finds nothing without a Unity Editor', () => {
    expect(findSmartMerge(mac, fakeFileSystem([]))).toBeNull();
    expect(findSmartMerge(windows, fakeFileSystem([]))).toBeNull();
    expect(findSmartMerge(linux, fakeFileSystem([]))).toBeNull();
  });
});

describe('SMART_MERGE_ARGS', () => {
  it('merges incoming as its left (theirs) side and yours as its right (mine), opening nothing', () => {
    const files = { base: 'a.BASE.prefab', yours: 'a.YOURS.prefab', incoming: 'a.INCOMING.prefab', result: 'a.prefab', baseName: 'Base', yoursName: 'Yours', incomingName: 'Incoming', fileName: 'a.prefab' };
    expect(fillArgs(SMART_MERGE_ARGS, files)).toEqual(['merge', '-h', '--force', '--fallback', 'none', 'a.BASE.prefab', 'a.INCOMING.prefab', 'a.YOURS.prefab', 'a.prefab']);
  });
});

describe('judgeSmartMerge', () => {
  const run = (exitCode: number | null) => ({ exitCode, errorOutput: '', seconds: 0.2 });
  const merged = Buffer.from('%YAML 1.1\nmerged\n');

  it('takes the result when it merged every change', () => {
    expect(judgeSmartMerge(run(0), merged)).toEqual({ kind: 'merged', text: '%YAML 1.1\nmerged\n' });
  });

  it('never takes a result with conflicts left, which holds the base’s values where the sides disagree', () => {
    expect(judgeSmartMerge(run(2), merged)).toEqual({ kind: 'notMerged' });
  });

  it('leaves the file to the tool when it couldn’t merge it or wrote nothing, and says when the user stopped it', () => {
    expect(judgeSmartMerge(run(1), merged)).toEqual({ kind: 'notMerged' });
    expect(judgeSmartMerge(run(0), null)).toEqual({ kind: 'notMerged' });
    expect(judgeSmartMerge(run(0), Buffer.alloc(0))).toEqual({ kind: 'notMerged' });
    expect(judgeSmartMerge(run(null), merged)).toEqual({ kind: 'stopped' });
  });
});

describe('smartMergeWentWrong', () => {
  const run = (exitCode: number | null) => ({ exitCode, errorOutput: '', seconds: 0.2 });

  it('warns about a failure, not about a merge or conflicts left or the user stopping it', () => {
    expect([0, 2, null, 1, 3].map((code) => smartMergeWentWrong(run(code)))).toEqual([false, false, false, true, true]);
  });
});
