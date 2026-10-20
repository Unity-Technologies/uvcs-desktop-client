import type { SmartMergeOutcome, SmartMergeTool } from '@shared/domain/mergeTools';
import type { AppFileSystem } from '../../system/apps/appFileSystem';
import { pathFor, type Whereabouts } from '../../system/apps/whereabouts';
import type { ToolRun } from './launch';
import { findUnityEditors, type UnityEditor } from './unityEditors';
import { compareUnityVersions } from './unityVersion';

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

/**
 * What Smart Merge did, by its exit code: 0 merged every change; anything else (2: conflicts it left, 1: a file it
 * couldn't read or merge) leaves the file to the merge tool. A result written with conflicts left holds the base's
 * values where the sides disagree, a merge that looks finished but isn't: it is never taken.
 */
export function judgeSmartMerge(run: ToolRun, result: Buffer | null): SmartMergeOutcome {
  if (run.exitCode === null) return { kind: 'stopped' };
  if (run.exitCode !== 0 || !result || result.length === 0) return { kind: 'notMerged' };
  return { kind: 'merged', text: result.toString('utf8') };
}

/** Exit codes that say something went wrong rather than "conflicts left", worth a warning in the console. */
export function smartMergeWentWrong(run: ToolRun): boolean {
  return run.exitCode !== null && run.exitCode !== 0 && run.exitCode !== 2;
}
