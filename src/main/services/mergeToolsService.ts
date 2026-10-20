import { existsSync } from 'node:fs';
import { open as openFile, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dialog } from 'electron';
import type { MergeToolsApi } from '@shared/api/mergeTools';
import type { ContentSource } from '@shared/domain/content';
import type { MergeToolOutcome, MergeToolRequest, SmartMergeTool } from '@shared/domain/mergeTools';
import { saveVersion } from '../files/saveContent';
import { withTempDirectory } from '../files/tempFile';
import { fillArgs, type MergeToolFiles } from '../merge/mergeTools/commandLine';
import { detectKnownTools } from '../merge/mergeTools/detectTools';
import { KNOWN_TOOLS } from '../merge/mergeTools/knownTools';
import { activateApp, launchMergeTool } from '../merge/mergeTools/launch';
import { mergeToolList } from '../merge/mergeTools/mergeToolList';
import { findSmartMerge, isUnityYaml, judgeSmartMerge, SMART_MERGE_ARGS, UNITY_YAML_HEADER_BYTES } from '../merge/mergeTools/smartMerge';
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
    const { tools, smartMerge } = await list();
    const tool = tools.find((candidate) => candidate.id === request.toolId);
    if (!tool) return { kind: 'failed', message: "That merge tool isn't installed anymore." };

    const stop = new AbortController();
    open.set(request.sessionId, { stop, bundle: tool.canBringToFront ? appBundleOf(tool.executable) : null });
    try {
      return await withTempDirectory(async (directory) => {
        const files = await writeToolFiles(workspacePath, request, directory);
        const start = await readFile(files.result);
        const merged = request.trySmartMergeFirst && smartMerge && (await smartMerged(smartMerge, files, start, stop.signal));
        if (merged) return merged;
        if (stop.signal.aborted) return { kind: 'unchanged', exitCode: null, errorOutput: '' };
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
   * Smart Merge's merge of a Unity asset, when it merged every change; otherwise null, with the result file put back
   * as the tool must find it (Smart Merge writes the base's values where it left conflicts). Smart Merge failing to
   * start only means the tool opens: the user asked for the tool.
   */
  async function smartMerged(smartMerge: SmartMergeTool, files: MergeToolFiles, start: Buffer, signal: AbortSignal): Promise<MergeToolOutcome | null> {
    const [yours, incoming] = await Promise.all([startOf(files.yours), startOf(files.incoming)]);
    if (!isUnityYaml(yours) || !isUnityYaml(incoming)) return null;
    const run = await launchMergeTool(smartMerge.executable, fillArgs(SMART_MERGE_ARGS, files), signal).catch(() => null);
    const outcome = run && !signal.aborted ? judgeSmartMerge(run, await readIfThere(files.result)) : null;
    if (!outcome) await writeFile(files.result, start);
    return outcome;
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

/** The first bytes of a file, as text: enough for its header, without reading a scene of tens of MB. */
async function startOf(path: string): Promise<string> {
  const file = await openFile(path);
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(UNITY_YAML_HEADER_BYTES), 0, UNITY_YAML_HEADER_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await file.close();
  }
}

async function readIfThere(path: string): Promise<Buffer | null> {
  return existsSync(path) ? readFile(path) : null;
}
