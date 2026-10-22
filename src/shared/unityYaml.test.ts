import { describe, expect, it } from 'vitest';
import { EMPTY_UNITY_YAML, isUnityYaml, unityYamlMergeTakes } from './unityYaml';

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

describe('unityYamlMergeTakes', () => {
  const ASSET = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1 &100\nGameObject:\n';
  const META = 'fileFormatVersion: 2\nguid: 0123456789abcdef\n';

  it('takes Unity assets saved as text, by their header on both sides, whatever their extension', () => {
    expect(unityYamlMergeTakes('Assets/Red.mat', ASSET, ASSET, true)).toBe(true);
    expect(unityYamlMergeTakes('Assets/Red.mat', ASSET, META, true)).toBe(false);
  });

  it('takes a .meta file by its name, in any case where the OS ignores it, and in either kind of path', () => {
    expect(unityYamlMergeTakes('Assets/Hero.prefab.meta', META, META, false)).toBe(true);
    expect(unityYamlMergeTakes('Assets\\Hero.prefab.META', META, META, true)).toBe(true);
    expect(unityYamlMergeTakes('Assets/Hero.prefab.META', META, META, false)).toBe(false);
  });

  it('takes no other text, nor a side that isn’t text', () => {
    expect(unityYamlMergeTakes('Assets/notes.txt', META, META, true)).toBe(false);
    expect(unityYamlMergeTakes('Assets/meta/notes.txt', META, META, true)).toBe(false);
    expect(unityYamlMergeTakes('Assets/Hero.prefab.meta', undefined, META, true)).toBe(false);
  });
});
