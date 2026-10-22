import { Boxes } from 'lucide-react';
import { appIcon } from '../../../components/externalApps/appIcon';
import type { Action, Icon } from '../../../lib/actions';
import { mergerName, type Merger } from './mergeToolFor';

export interface ToolChoice {
  merger: Merger;
  label: string;
}

/**
 * Merge tools to open now, each with its app's icon: picking one opens the file (or starts the run) in it this once.
 * The settings stay as they are: Settings › Merge says what each file opens in.
 */
export function toolChoiceEntries(choices: ToolChoice[], open: (merger: Merger) => void): Action[] {
  return choices.map(({ merger, label }) => ({ id: `tool.${mergerId(merger)}`, label, icon: mergerIcon(merger), run: () => open(merger) }));
}

/** Its app's icon, where the OS gave one; UnityYAMLMerge, which has no window, a box of assets. */
export function mergerIcon(merger: Merger): Icon | undefined {
  return merger.kind === 'tool' ? appIcon(merger.tool) : Boxes;
}

/** The mergers as choices, each by its name ("UnityYAMLMerge", "Meld"). */
export function mergerChoices(mergers: readonly Merger[]): ToolChoice[] {
  return mergers.map((merger) => ({ merger, label: mergerName(merger) }));
}

function mergerId(merger: Merger): string {
  return merger.kind === 'tool' ? merger.tool.id : merger.merge.id;
}
