import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dialog } from 'electron';
import type { MergeToolsApi } from '@shared/api/mergeTools';
import type { ContentSource } from '@shared/domain/content';
import type { MergeToolOutcome, MergeToolRequest, SmartMergeOutcome, SmartMergeRequest, SmartMergeTool } from '@shared/domain/mergeTools';
import { EMPTY_UNITY_YAML, isUnityYaml } from '@shared/unityYaml';
import { saveVersion } from '../files/saveContent';
import { withTempDirectory } from '../files/tempFile';
import { fillArgs, type MergeToolFiles } from '../merge/mergeTools/commandLine';
import { detectKnownTools } from '../merge/mergeTools/detectTools';
import { KNOWN_TOOLS } from '../merge/mergeTools/knownTools';
import { activateApp, launchMergeTool } from '../merge/mergeTools/launch';
import { mergeToolList } from '../merge/mergeTools/mergeToolList';
import { findSmartMerge, judgeSmartMerge, SMART_MERGE_ARGS, smartMergeWentWrong } from '../merge/mergeTools/smartMerge';
import { toolFileNames } from '../merge/mergeTools/toolFileNames';
import { judgeToolResult } from '../merge/mergeTools/toolResult';
import { appBundleOf } from '../system/apps/appBundle';
import { appExecutable } from '../system/apps/appExecutable';
import { diskFileSystem } from '../system/apps/appFileSystem';
import type { Whereabouts } from '../system/apps/whereabouts';
import type { AppsContext, ServiceContext } from './ServiceContext';

interface OpenTool {
  stop: AbortController;
  bundle: string | null;
}

/** Where Smart Merge is: looked for on each call, as the other tools are. Passed in so tests don't see this machine's. */
export type SmartMergeFinder = (where: Whereabouts) => SmartMergeTool | null;

const findSmartMergeOnDisk: SmartMergeFinder = (where) => findSmartMerge(where, diskFileSystem);

export function createMergeToolsService(
  { cm, settings, workspaceCopies }: ServiceContext,
  { installedApps, icons }: Pick<AppsContext, 'installedApps' | 'icons'>,
  smartMergeFinder: SmartMergeFinder = findSmartMergeOnDisk,
): MergeToolsApi {
  const open = new Map<string, OpenTool>();

  async function list() {
    const where: Whereabouts = { platform: process.platform, env: process.env, home: homedir(), cmPath: cm.executable };
    const { mergeTool, customMergeTools, mergeToolArgs } = settings.get();
    return mergeToolList({
      detected: detectKnownTools(KNOWN_TOOLS, where, diskFileSystem, await installedApps.get()),
      smartMerge: smartMergeFinder(where),
      custom: customMergeTools,
      argsOverrides: mergeToolArgs,
      preference: mergeTool,
      platform: process.platform,
    });
  }

  async function resolve(workspacePath: string, request: MergeToolRequest): Promise<MergeToolOutcome> {
    const tool = (await list()).tools.find((candidate) => candidate.id === request.toolId);
    if (!tool) return { kind: 'failed', message: "That merge tool isn't installed anymore." };

    const stop = new AbortController();
    open.set(request.sessionId, { stop, bundle: tool.canBringToFront ? appBundleOf(tool.executable) : null });
    try {
      return await withTempDirectory(async (directory) => {
        const files = await writeToolFiles(workspacePath, request, directory);
        const start = await readFile(files.result);
        const run = await launchMergeTool(tool.executable, fillArgs(tool.args, files), stop.signal);
        return judgeToolResult({ start, result: await readIfThere(files.result) }, run);
      });
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
    } finally {
      open.delete(request.sessionId);
    }
  }

  /**
   * Runs Smart Merge on the versions given, hidden, with no fallback tool. Anything short of a full merge is
   * `notMerged`, and the merge tool takes over: no Unity Editor, sides that aren't Unity assets, Smart Merge failing to
   * start or leaving conflicts. What went wrong (other than conflicts left) is warned in the console, for diagnosis.
   */
  async function smartMerge(request: SmartMergeRequest): Promise<SmartMergeOutcome> {
    const where: Whereabouts = { platform: process.platform, env: process.env, home: homedir(), cmPath: cm.executable };
    const smartMergeTool = smartMergeFinder(where);
    if (!smartMergeTool || !isUnityYaml(request.yours) || !isUnityYaml(request.incoming)) return { kind: 'notMerged' };

    const stop = new AbortController();
    open.set(request.sessionId, { stop, bundle: null });
    try {
      return await withTempDirectory(async (directory) => {
        const files = await writeSmartMergeFiles(request, directory);
        const run = await launchMergeTool(smartMergeTool.executable, fillArgs(SMART_MERGE_ARGS, files), stop.signal, { hidden: true });
        // Stopped as it exited on its own: still stopped, or the tool would open after the user stopped (or left the page).
        if (stop.signal.aborted) return { kind: 'stopped' };
        if (smartMergeWentWrong(run)) console.warn('[smart merge]', `${request.path}: exit code ${run.exitCode}`, run.errorOutput);
        return judgeSmartMerge(run, await readIfThere(files.result));
      });
    } catch (error) {
      console.warn('[smart merge]', `${request.path}:`, error instanceof Error ? error.message : String(error));
      return { kind: 'notMerged' };
    } finally {
      open.delete(request.sessionId);
    }
  }

  /**
   * The three versions as files Smart Merge reads, named after the file. An empty base (the base revision was an empty
   * file, filled differently on each side) becomes an asset with no objects (`EMPTY_UNITY_YAML`): Smart Merge refuses
   * an empty file, and merges both sides' objects from that one.
   */
  async function writeSmartMergeFiles(request: SmartMergeRequest, directory: string): Promise<MergeToolFiles> {
    const names = toolFileNames(request.path);
    const files = { base: join(directory, names.base), yours: join(directory, names.yours), incoming: join(directory, names.incoming), result: join(directory, names.result) };
    await writeFile(files.base, request.base || EMPTY_UNITY_YAML, 'utf8');
    await writeFile(files.yours, request.yours, 'utf8');
    await writeFile(files.incoming, request.incoming, 'utf8');
    return { ...files, baseName: 'Base', yoursName: 'Yours', incomingName: 'Incoming', fileName: names.result };
  }

  /** The three versions and the result, holding the text to start from, as files in `directory` the tool can open. */
  async function writeToolFiles(workspacePath: string, request: MergeToolRequest, directory: string): Promise<MergeToolFiles> {
    const names = toolFileNames(request.path);
    const files = {
      base: join(directory, names.base),
      yours: join(directory, names.yours),
      incoming: join(directory, names.incoming),
      result: join(directory, names.result),
    };
    await save(workspacePath, request.base, files.base);
    await save(workspacePath, request.yours, files.yours);
    await save(workspacePath, request.incoming, files.incoming);
    await writeFile(files.result, request.startText, 'utf8');
    return { ...files, baseName: request.names.base, yoursName: request.names.yours, incomingName: request.names.incoming, fileName: names.result };
  }

  function save(workspacePath: string, source: ContentSource, target: string): Promise<void> {
    if (source.kind === 'reviewSnapshot') throw new Error('A review snapshot is not a version to merge.');
    return saveVersion(cm, workspaceCopies, workspacePath, source, target);
  }

  return {
    list: async () => {
      const found = await list();
      return { ...found, tools: await Promise.all(found.tools.map((tool) => icons.withIcon(tool, tool.executable))) };
    },
    resolve,
    smartMerge,
    stopWaiting: async (sessionId) => open.get(sessionId)?.stop.abort(),
    bringToFront: async (sessionId) => {
      const bundle = open.get(sessionId)?.bundle;
      if (bundle) await activateApp(bundle);
    },
    pickProgram: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Choose a merge app',
        defaultPath: process.platform === 'darwin' ? '/Applications' : undefined,
        properties: ['openFile'],
      });
      const picked = result.canceled ? undefined : result.filePaths[0];
      return picked ? appExecutable(picked, diskFileSystem) : null;
    },
  };
}

async function readIfThere(path: string): Promise<Buffer | null> {
  return existsSync(path) ? readFile(path) : null;
}
