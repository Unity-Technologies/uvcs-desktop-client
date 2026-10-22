/**
 * Unity assets saved as text (scenes, prefabs, materials, ScriptableObjects…) start with `%YAML 1.1` and Unity's tag.
 * Smart Merge merges them by their objects instead of their lines.
 */
const UNITY_YAML_HEADER_LINES = /^\uFEFF?%YAML 1\.1\r?\n%TAG !u! tag:unity3d\.com,2011:/;

/**
 * The header alone: an asset with no objects, the base Smart Merge gets when the base revision was an empty file (one
 * checked in empty, then filled differently on each side). A file added on both sides never gets here: `cm` makes it a
 * directory conflict.
 */
export const EMPTY_UNITY_YAML = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';

/** Whether a version is a Unity asset saved as text: Unity's YAML header. A `.meta` file has none. */
export function isUnityYaml(text: string): boolean {
  return UNITY_YAML_HEADER_LINES.test(text);
}

/**
 * Whether UnityYAMLMerge runs on a conflicting file: both sides are Unity assets saved as text (their header), whatever
 * the extension. Anything else, a `.meta` file too, goes straight to the rule's fallback tool: UnityYAMLMerge rejects
 * real `.meta` files ("not a valid text serialized YAML file"). One test for the page and for main.
 */
export function unityYamlMergeTakes(yours: string | undefined, incoming: string | undefined): boolean {
  return yours !== undefined && incoming !== undefined && isUnityYaml(yours) && isUnityYaml(incoming);
}
