import { describe, expect, it } from 'vitest';
import { fakeFileSystem, linux, mac, windows } from '../../system/apps/testing/appFixtures';
import { fillArgs } from './commandLine';
import { findSmartMerge, isUnityYaml, judgeSmartMerge, SMART_MERGE_ARGS, UNITY_YAML_HEADER_BYTES } from './smartMerge';

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

describe('isUnityYaml', () => {
  const HEADER = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1 &100\nGameObject:\n';

  it('knows a Unity asset saved as text by its header, with LF or CRLF line ends and a BOM', () => {
    expect(isUnityYaml(HEADER)).toBe(true);
    expect(isUnityYaml(HEADER.replaceAll('\n', '\r\n'))).toBe(true);
    expect(isUnityYaml(`\uFEFF${HEADER}`)).toBe(true);
  });

  it('fits the header in the bytes read for it, even with a BOM and CRLF', () => {
    const longest = `\uFEFF${HEADER.replaceAll('\n', '\r\n')}`;
    expect(isUnityYaml(Buffer.from(longest).subarray(0, UNITY_YAML_HEADER_BYTES).toString('utf8'))).toBe(true);
  });

  it('turns away other text: plain YAML, a .meta file, code, an empty file', () => {
    expect(isUnityYaml('%YAML 1.2\n---\nname: x\n')).toBe(false);
    expect(isUnityYaml('fileFormatVersion: 2\nguid: 0123456789abcdef\n')).toBe(false);
    expect(isUnityYaml('using UnityEngine;\n')).toBe(false);
    expect(isUnityYaml('')).toBe(false);
  });
});

describe('judgeSmartMerge', () => {
  const run = (exitCode: number | null) => ({ exitCode, errorOutput: '', seconds: 0.2 });
  const merged = Buffer.from('%YAML 1.1\nmerged\n');

  it('takes the result when it merged every change', () => {
    expect(judgeSmartMerge(run(0), merged)).toEqual({ kind: 'resolved', text: '%YAML 1.1\nmerged\n', tool: 'Smart Merge' });
  });

  it('never takes a result with conflicts left, which holds the base’s values where the sides disagree', () => {
    expect(judgeSmartMerge(run(2), merged)).toBeNull();
  });

  it('leaves the file to the user when it couldn’t merge it, was stopped, or wrote nothing', () => {
    expect(judgeSmartMerge(run(1), merged)).toBeNull();
    expect(judgeSmartMerge(run(null), merged)).toBeNull();
    expect(judgeSmartMerge(run(0), null)).toBeNull();
    expect(judgeSmartMerge(run(0), Buffer.alloc(0))).toBeNull();
  });
});
