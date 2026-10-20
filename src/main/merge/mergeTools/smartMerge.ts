import type { MergeToolOutcome, SmartMergeTool } from '@shared/domain/mergeTools';
import type { AppFileSystem } from '../../system/apps/appFileSystem';
import { pathFor, type Whereabouts } from '../../system/apps/whereabouts';
import type { ToolRun } from './launch';
import { findUnityEditors, type UnityEditor } from './unityEditors';
import { compareUnityVersions } from './unityVersion';

/** Unity's own name for its merge of scenes, prefabs and other assets (the Unity Manual's "Smart merge"). */
export const SMART_MERGE_NAME = 'Smart Merge';

/**
 * Smart Merge, the `UnityYAMLMerge` program every Unity Editor ships with, from the newest editor installed (releases
 * before alphas and betas: `compareUnityVersions`). Null when there's no Unity Editor here.
 */
export function findSmartMerge(where: Whereabouts, fs: AppFileSystem): SmartMergeTool | null {
  const editors = findUnityEditors(where, fs).sort((a, b) => compareUnityVersions(a.version, b.version));
  for (const editor of editors) {
    const executable = programInEditor(editor, where).find((candidate) => fs.exists(candidate));
    if (executable) return { executable, editorVersion: editor.version };
  }
  return null;
}

/** macOS editors keep it in `Contents/Helpers` since Unity 6.3, in `Contents/Tools` before; the others in `Data/Tools`. */
function programInEditor(editor: UnityEditor, where: Whereabouts): string[] {
  const path = pathFor(where);
  if (where.platform === 'darwin') return ['Helpers', 'Tools'].map((folder) => path.join(editor.folder, 'Contents', folder, 'UnityYAMLMerge'));
  return [path.join(editor.folder, 'Data', 'Tools', where.platform === 'win32' ? 'UnityYAMLMerge.exe' : 'UnityYAMLMerge')];
}

/**
 * `UnityYAMLMerge merge <base> <left: theirs> <right: mine> <result>`, without ever opening anything: `-h` shows no
 * error dialog, `--fallback none` runs no other tool on what it can't merge. `--force` lets it merge every Unity asset
 * (materials, animations, ScriptableObjects…), not only the `.unity`, `.prefab` and `.meta` files it knows by name: it
 * refuses a file that isn't Unity's YAML anyway.
 */
export const SMART_MERGE_ARGS = ['merge', '-h', '--force', '--fallback', 'none', '{base}', '{incoming}', '{yours}', '{result}'];

/** The start of every asset Unity saves as text: `%YAML 1.1` and Unity's tag. */
const UNITY_YAML_HEADER = /^\uFEFF?%YAML 1\.1\r?\n%TAG !u! tag:unity3d\.com,2011:/;

/** How much of a file `isUnityYaml` needs: the header, with room for a BOM and CRLF line ends. */
export const UNITY_YAML_HEADER_BYTES = 64;

/** Whether a version is a Unity asset saved as text, which Smart Merge merges by its objects instead of its lines. */
export function isUnityYaml(text: string): boolean {
  return UNITY_YAML_HEADER.test(text);
}

/**
 * What Smart Merge did, by its exit code: 0 merged every change; anything else (2: conflicts it left, 1: a file it
 * couldn't read) leaves the file to the user. A result written with conflicts left holds the base's values where the
 * sides disagree, a merge that looks finished but isn't: it is never taken. Null when it didn't merge.
 */
export function judgeSmartMerge(run: ToolRun, result: Buffer | null): MergeToolOutcome | null {
  if (run.exitCode !== 0 || !result || result.length === 0) return null;
  return { kind: 'resolved', text: result.toString('utf8'), tool: SMART_MERGE_NAME };
}
