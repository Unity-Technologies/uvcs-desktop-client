import { describe, expect, it } from 'vitest';
import { EMPTY_UNITY_YAML, isUnityYaml } from './unityYaml';

describe('isUnityYaml', () => {
  const ASSET = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1 &100\nGameObject:\n';

  it('knows a Unity asset saved as text by its header, with LF or CRLF line ends and a BOM', () => {
    expect(isUnityYaml(ASSET)).toBe(true);
    expect(isUnityYaml(ASSET.replaceAll('\n', '\r\n'))).toBe(true);
    expect(isUnityYaml(`\uFEFF${ASSET}`)).toBe(true);
    expect(isUnityYaml(EMPTY_UNITY_YAML)).toBe(true);
  });

  it('turns away other text: plain YAML, a .meta file, code, an empty file', () => {
    expect(isUnityYaml('%YAML 1.2\n---\nname: x\n')).toBe(false);
    expect(isUnityYaml('fileFormatVersion: 2\nguid: 0123456789abcdef\n')).toBe(false);
    expect(isUnityYaml('using UnityEngine;\n')).toBe(false);
    expect(isUnityYaml('')).toBe(false);
  });
});
