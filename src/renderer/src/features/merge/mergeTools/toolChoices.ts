import type { MergeTool } from '@shared/domain/mergeTools';
import { appIcon } from '../../../components/externalApps/appIcon';
import type { Action } from '../../../lib/actions';

export interface ToolChoice {
  tool: MergeTool;
  label: string;
}

/**
 * Merge tools to open now, each with its app's icon: picking one opens the file (or starts the run) in it this once.
 * The settings stay as they are: Settings › Merge says which tool each file opens in.
 */
export function toolChoiceEntries(choices: ToolChoice[], open: (tool: MergeTool) => void): Action[] {
  return choices.map(({ tool, label }) => ({ id: `tool.${tool.id}`, label, icon: appIcon(tool), run: () => open(tool) }));
}

/** Every tool but the one given (the file's own, which its button or entry already names). */
export function otherTools(tools: readonly MergeTool[], tool: MergeTool | undefined): MergeTool[] {
  return tools.filter((other) => other.id !== tool?.id);
}
