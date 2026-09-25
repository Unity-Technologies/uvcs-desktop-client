import { AppWindow, Check, FolderOpen, ListChecks, PencilLine, Settings } from 'lucide-react';
import { canMergeIn, type MergeTool } from '@shared/domain/mergeTools';
import { openSettingsDialogAt } from '../../../app/settings/SettingsDialog';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../../lib/actions';
import { pluralize } from '../../../lib/text';
import { SplitButton } from '../../../ui/SplitButton';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { addMergeToolAndPick } from './CustomMergeToolDialog';
import { waitsForTool } from './mergeToolOutcome';
import { preferMergeTool, useMergeTools } from './useMergeTools';

/** What the merge offers to do with merge tools, for the file at hand and the others waiting. */
export interface ConflictToolActions {
  resolveIn: (key: string, tool: MergeTool) => void;
  resolveAllIn: (tool: MergeTool) => void;
  states: FileConflictState[];
}

interface MergeToolButtonProps {
  state: FileConflictState;
  actions: ConflictToolActions;
  /** Resolving by hand in the app, kept in the menu for when no tool suits. */
  onEditInApp?: () => void;
  variant?: 'primary' | 'secondary';
}

/**
 * "Resolve in <tool>": the preferred merge tool the file can open in, with the others found behind the caret. Picking
 * one there makes it the preferred one from then on. Nothing opens until the user clicks.
 */
export function MergeToolButton({ state, actions, onEditInApp, variant = 'primary' }: MergeToolButtonProps) {
  const { tools, preferredId } = useMergeTools();
  const fits = tools.filter((tool) => canMergeIn(tool, state.file.path, state.isBinary));
  const primary = fits.find((tool) => tool.id === preferredId) ?? fits[0];
  const resolve = (tool: MergeTool): void => actions.resolveIn(state.file.key, tool);
  const pick = (tool: MergeTool): void => {
    if (tool.id !== preferredId) void preferMergeTool(tool.id);
    resolve(tool);
  };
  const addApp = async (): Promise<void> => {
    const added = await addMergeToolAndPick();
    if (added && canMergeIn(added, state.file.path, state.isBinary)) resolve(added);
  };
  const waiting = primary ? actions.states.filter((other) => waitsForTool(other, primary)).length : 0;

  const menu: MenuEntry[] = tidyMenu([
    ...fits.map((tool) => ({ id: tool.id, label: tool.name, icon: tool.id === primary?.id ? Check : undefined, run: () => pick(tool) })),
    SEPARATOR,
    primary &&
      waiting > 1 && {
        id: 'resolveAll',
        label: `Resolve all ${pluralize(waiting, 'file')} in ${primary.name}, one by one`,
        icon: ListChecks,
        run: () => actions.resolveAllIn(primary),
      },
    SEPARATOR,
    !state.isBinary && { id: 'addApp', label: 'Choose another app…', icon: FolderOpen, run: () => void addApp() },
    onEditInApp && { id: 'editInApp', label: 'Edit the text in the app', icon: PencilLine, run: onEditInApp },
    { id: 'settings', label: 'Merge tool settings…', icon: Settings, run: () => openSettingsDialogAt('merge') },
  ]);

  if (!primary) {
    if (state.isBinary) return null;
    return (
      <SplitButton variant={variant} icon={<FolderOpen size={13} />} menu={menu} menuLabel="More ways to resolve" tip="No merge tool was found here: pick the app to resolve conflicts in" onClick={() => void addApp()}>
        Choose a merge app…
      </SplitButton>
    );
  }
  return (
    <SplitButton
      variant={variant}
      icon={<AppWindow size={13} />}
      menu={menu}
      menuLabel="Other merge tools"
      tip={`Open the three versions in ${primary.name}; save the result there and close it to come back`}
      onClick={() => resolve(primary)}
    >
      Resolve in {primary.name}
    </SplitButton>
  );
}
