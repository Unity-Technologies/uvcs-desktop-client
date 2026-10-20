/**
 * Unity assets saved as text (scenes, prefabs, materials, ScriptableObjects…) start with `%YAML 1.1` and Unity's tag.
 * Smart Merge merges them by their objects instead of their lines.
 */
const UNITY_YAML_HEADER_LINES = /^\uFEFF?%YAML 1\.1\r?\n%TAG !u! tag:unity3d\.com,2011:/;

/** The header alone: an asset with no objects, the base Smart Merge gets when both sides added the file. */
export const EMPTY_UNITY_YAML = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';

/** Whether a version is a Unity asset saved as text. A `.meta` file isn't: it has no header. */
export function isUnityYaml(text: string): boolean {
  return UNITY_YAML_HEADER_LINES.test(text);
}
