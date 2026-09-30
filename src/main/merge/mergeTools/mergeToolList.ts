import { AUTO_MERGE_TOOL, type CustomMergeTool, type MergeTool, type MergeToolList } from '@shared/domain/mergeTools';
import type { DetectedTool } from './detectTools';
import { UVCS_TOOL_ID } from './knownTools';

export interface MergeToolSources {
  detected: DetectedTool[];
  custom: CustomMergeTool[];
  /** The user's arguments for a tool, by its id. */
  argsOverrides: Record<string, string[]>;
  /** `auto` or a tool id. */
  preference: string;
  platform: NodeJS.Platform;
}

/** Every tool on offer, the UVCS one first, then the others found, and the user's own. */
export function mergeToolList(sources: MergeToolSources): MergeToolList {
  const withArgs = (tool: Omit<MergeTool, 'args' | 'canBringToFront'>): MergeTool => ({
    ...tool,
    args: sources.argsOverrides[tool.id] ?? tool.defaultArgs,
    canBringToFront: sources.platform === 'darwin' && appBundleOf(tool.executable) !== null,
  });
  const known = sources.detected.map(({ tool, executable }) => withArgs({ id: tool.id, name: tool.name, origin: 'known', executable, defaultArgs: tool.args }));
  const [uvcs, others] = [known.filter((tool) => tool.id === UVCS_TOOL_ID), known.filter((tool) => tool.id !== UVCS_TOOL_ID)];
  const custom = sources.custom.map((tool) => withArgs({ id: tool.id, name: tool.name, origin: 'custom', executable: tool.executable, defaultArgs: tool.args }));

  const tools = [...uvcs, ...others, ...custom];
  return { tools, preferredId: preferredTool(tools, sources.preference) };
}

/** The user's pick while it's still there; otherwise the UVCS tool, else the first one found. */
function preferredTool(tools: MergeTool[], preference: string): string | null {
  if (preference !== AUTO_MERGE_TOOL && tools.some((tool) => tool.id === preference)) return preference;
  return (tools.find((tool) => tool.id === UVCS_TOOL_ID) ?? tools[0])?.id ?? null;
}

/** `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code` → `/Applications/Visual Studio Code.app`. */
export function appBundleOf(executable: string): string | null {
  const match = /^(.*?\.app)\//.exec(executable);
  return match ? match[1]! : null;
}
