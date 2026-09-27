import { AUTO_MERGE_TOOL, type CustomMergeTool, type MergeTool, type MergeToolList } from '@shared/domain/mergeTools';
import type { ClientConfMergeTool } from '../../plasticConfig/clientConfMergeTools';
import type { DetectedTool } from './detectTools';
import { UVCS_TOOL_ID } from './knownTools';

export interface MergeToolSources {
  detected: DetectedTool[];
  /** From client.conf, with the program found on this machine. */
  clientConf: (ClientConfMergeTool & { found: string })[];
  custom: CustomMergeTool[];
  /** The user's arguments for a tool, by its id. */
  argsOverrides: Record<string, string[]>;
  /** `auto` or a tool id. */
  preference: string;
  platform: NodeJS.Platform;
}

/** Every tool on offer, the UVCS one first, then client.conf's, the others found, and the user's own. */
export function mergeToolList(sources: MergeToolSources): MergeToolList {
  const withArgs = (tool: Omit<MergeTool, 'args' | 'canBringToFront'>): MergeTool => ({
    ...tool,
    args: sources.argsOverrides[tool.id] ?? tool.defaultArgs,
    canBringToFront: sources.platform === 'darwin' && appBundleOf(tool.executable) !== null,
  });
  const known = sources.detected.map(({ tool, executable }) =>
    withArgs({ id: tool.id, name: tool.name, origin: 'known', executable, defaultArgs: tool.args, extensions: null }),
  );
  const [uvcs, others] = [known.filter((tool) => tool.id === UVCS_TOOL_ID), known.filter((tool) => tool.id !== UVCS_TOOL_ID)];
  const fromClientConf = sources.clientConf.map((tool, index) =>
    withArgs({
      id: `clientConf:${index}`,
      name: `${programName(tool.executable)} (client.conf${tool.extensions ? `, ${tool.extensions.join(' ')}` : ''})`,
      origin: 'clientConf',
      executable: tool.found,
      defaultArgs: tool.args,
      extensions: tool.extensions,
    }),
  );
  const custom = sources.custom.map((tool) =>
    withArgs({ id: tool.id, name: tool.name, origin: 'custom', executable: tool.executable, defaultArgs: tool.args, extensions: null }),
  );

  const tools = [...uvcs, ...fromClientConf, ...others, ...custom];
  return { tools, preferredId: preferredTool(tools, sources.preference) };
}

/** The user's pick while it's still there; otherwise the UVCS tool, else the first one found. */
function preferredTool(tools: MergeTool[], preference: string): string | null {
  if (preference !== AUTO_MERGE_TOOL && tools.some((tool) => tool.id === preference)) return preference;
  return (tools.find((tool) => tool.id === UVCS_TOOL_ID) ?? tools.find((tool) => tool.extensions === null))?.id ?? null;
}

/** `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code` → `/Applications/Visual Studio Code.app`. */
export function appBundleOf(executable: string): string | null {
  const match = /^(.*?\.app)\//.exec(executable);
  return match ? match[1]! : null;
}

function programName(executable: string): string {
  return executable.split(/[\\/]/).pop()!.replace(/\.(exe|cmd|bat)$/i, '');
}
