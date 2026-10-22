import { unityYamlMergeId, type SmartMergeOutcome, type UnityYamlMergeTool } from '@shared/domain/mergeTools';
import type { AppFileSystem } from '../../system/apps/appFileSystem';
import { pathFor, type Whereabouts } from '../../system/apps/whereabouts';
import type { ToolRun } from './launch';
import { findUnityEditors, type UnityEditor } from './unityEditors';
import { compareUnityVersions } from './unityVersion';

/**
 * The `UnityYAMLMerge` program (Unity's Smart Merge) of every Unity Editor installed, the newest first (releases
 * before alphas and betas: `compareUnityVersions`). None when there's no Unity Editor here.
 */
export function findUnityYamlMerges(where: Whereabouts, fs: AppFileSystem): UnityYamlMergeTool[] {
  const editors = findUnityEditors(where, fs).sort((a, b) => compareUnityVersions(a.version, b.version));
  return editors.flatMap((editor) => {
    const executable = programInEditor(editor, where).find((candidate) => fs.exists(candidate));
    return executable ? [{ id: unityYamlMergeId(editor.version), executable, editorVersion: editor.version }] : [];
  });
}

/** macOS editors keep it in `Contents/Helpers` since Unity 6.3, in `Contents/Tools` before; the others in `Data/Tools`. */
function programInEditor(editor: UnityEditor, where: Whereabouts): string[] {
  const path = pathFor(where);
  if (where.platform === 'darwin') return ['Helpers', 'Tools'].map((folder) => path.join(editor.folder, 'Contents', folder, 'UnityYAMLMerge'));
  return [path.join(editor.folder, 'Data', 'Tools', where.platform === 'win32' ? 'UnityYAMLMerge.exe' : 'UnityYAMLMerge')];
}


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
