import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dialog } from 'electron';
import type { MergeToolsApi } from '@shared/api/mergeTools';
import type { ContentSource } from '@shared/domain/content';
import type { MergeToolOutcome, MergeToolRequest } from '@shared/domain/mergeTools';
import { saveContent } from '../files/saveContent';
import { withTempDirectory } from '../files/tempFile';
import { appExecutable } from '../merge/mergeTools/appExecutable';
import { fillArgs } from '../merge/mergeTools/commandLine';
import { detectKnownTools, locateProgram, type ToolFileSystem } from '../merge/mergeTools/detectTools';
import { KNOWN_TOOLS, type Whereabouts } from '../merge/mergeTools/knownTools';
import { activateApp, launchMergeTool } from '../merge/mergeTools/launch';
import { appBundleOf, mergeToolList } from '../merge/mergeTools/mergeToolList';
import { judgeToolResult, toolFileNames } from '../merge/mergeTools/toolResult';
import { plasticConfigFile } from '../plasticConfig/configFolder';
import { readClientConfMergeTools } from '../plasticConfig/clientConfMergeTools';
import type { ServiceContext } from './ServiceContext';

const fileSystem: ToolFileSystem & { read(path: string): string | null } = {
  exists: (path) => {
    try {
      return statSync(path).isFile() || path.endsWith('.app');
    } catch {
      return false;
    }
  },
  list: (folder) => {
    try {
      return readdirSync(folder);
    } catch {
      return [];
    }
  },
  read: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
};

interface OpenTool {
  stop: AbortController;
  bundle: string | null;
}

export function createMergeToolsService({ cm, settings }: ServiceContext): MergeToolsApi {
  const open = new Map<string, OpenTool>();

  function list() {
    const where: Whereabouts = { platform: process.platform, env: process.env, home: homedir(), cmPath: cm.executable };
    const { mergeTool, customMergeTools, mergeToolArgs } = settings.get();
    const clientConf = readClientConfMergeTools(fileSystem.read(plasticConfigFile('client.conf')) ?? '').flatMap((tool) => {
      const found = locateProgram(tool.executable, where, fileSystem);
      return found ? [{ ...tool, found }] : [];
    });
    return mergeToolList({
      detected: detectKnownTools(KNOWN_TOOLS, where, fileSystem),
      clientConf,
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
        const names = toolFileNames(request.path);
        const file = (name: string): string => join(directory, name);
        await save(workspacePath, request.base, file(names.base));
        await save(workspacePath, request.yours, file(names.yours));
        await save(workspacePath, request.incoming, file(names.incoming));
        await writeFile(file(names.result), request.startText, 'utf8');
        const start = await readFile(file(names.result));

        const run = await launchMergeTool(
          tool.executable,
          fillArgs(tool.args, {
            base: file(names.base),
            yours: file(names.yours),
            incoming: file(names.incoming),
            result: file(names.result),
            baseName: request.names.base,
            yoursName: request.names.yours,
            incomingName: request.names.incoming,
            fileName: names.result,
          }),
          stop.signal,
        );
        return judgeToolResult({ start, result: await readIfThere(file(names.result)) }, run);
      });
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
    } finally {
      open.delete(request.sessionId);
    }
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
      return picked ? appExecutable(picked, fileSystem) : null;
    },
  };
}


async function readIfThere(path: string): Promise<Buffer | null> {
  return existsSync(path) ? readFile(path) : null;
}
