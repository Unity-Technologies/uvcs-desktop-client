import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dialog } from 'electron';
import type { MergeToolsApi } from '@shared/api/mergeTools';
import type { ContentSource } from '@shared/domain/content';
import type { MergeToolOutcome, MergeToolRequest } from '@shared/domain/mergeTools';
import { saveContent } from '../files/saveContent';
import { withTempDirectory } from '../files/tempFile';
import { fillArgs, type MergeToolFiles } from '../merge/mergeTools/commandLine';
import { detectKnownTools } from '../merge/mergeTools/detectTools';
import { KNOWN_TOOLS } from '../merge/mergeTools/knownTools';
import { activateApp, launchMergeTool } from '../merge/mergeTools/launch';
import { appBundleOf, mergeToolList } from '../merge/mergeTools/mergeToolList';
import { toolFileNames } from '../merge/mergeTools/toolFileNames';
import { judgeToolResult } from '../merge/mergeTools/toolResult';
import { appExecutable } from '../system/apps/appExecutable';
import { diskFileSystem } from '../system/apps/appFileSystem';
import type { Whereabouts } from '../system/apps/whereabouts';
import type { ServiceContext } from './ServiceContext';

interface OpenTool {
  stop: AbortController;
  bundle: string | null;
}

export function createMergeToolsService({ cm, settings }: ServiceContext): MergeToolsApi {
  const open = new Map<string, OpenTool>();

  function list() {
    const where: Whereabouts = { platform: process.platform, env: process.env, home: homedir(), cmPath: cm.executable };
    const { mergeTool, customMergeTools, mergeToolArgs } = settings.get();
    return mergeToolList({
      detected: detectKnownTools(KNOWN_TOOLS, where, diskFileSystem),
      custom: customMergeTools,
      argsOverrides: mergeToolArgs,
      preference: mergeTool,
      platform: process.platform,
    });
  }

  async function resolve(workspacePath: string, request: MergeToolRequest): Promise<MergeToolOutcome> {
    const tool = list().tools.find((candidate) => candidate.id === request.toolId);
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
    return saveContent(cm, workspacePath, source, target);
  }

  return {
    list: async () => list(),
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

async function readIfThere(path: string): Promise<Buffer | null> {
  return existsSync(path) ? readFile(path) : null;
}
