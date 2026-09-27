import { AppWindow, Check, FolderOpen, PencilLine, Settings } from 'lucide-react';
import { canMergeIn, type MergeTool } from '@shared/domain/mergeTools';
import { openSettingsDialogAt } from '../../../app/settings/SettingsDialog';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../../lib/actions';
import { SplitButton } from '../../../ui/SplitButton';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { addMergeToolAndPick } from './CustomMergeToolDialog';
import type { RunProgress } from './resolveRun';
import { preferMergeTool, useMergeTools } from './useMergeTools';

/** What the page offers to do with merge tools, for the file at hand. */
export interface ConflictToolActions {
  resolveIn: (key: string, tool: MergeTool) => void;
  /** Resolving one by one: its files open in turn, and no other opens meanwhile. */
  run: RunProgress | null;
  /** The page offers resolving every file one by one as its primary action: the file's own button steps back. */
  runOffered: boolean;
}

interface MergeToolButtonProps {
  state: FileConflictState;
  actions: ConflictToolActions;
  /** Resolving by hand in the app, kept in the menu for when no tool suits. */
  onEditInApp: () => void;
  variant?: 'primary' | 'secondary';
}

/**
 * "Resolve in <tool>", for a text file: the preferred merge tool the file can open in, with the others found behind the caret. Picking
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
  const running = actions.run ? `Resolving one by one in ${actions.run.toolName}` : undefined;

  const menu: MenuEntry[] = tidyMenu([
    ...fits.map((tool) => ({ id: tool.id, label: tool.name, icon: tool.id === primary?.id ? Check : undefined, run: () => pick(tool) })),
    SEPARATOR,
    { id: 'addApp', label: 'Choose another app…', icon: FolderOpen, run: () => void addApp() },
    { id: 'editInApp', label: 'Edit the text in the app', icon: PencilLine, run: onEditInApp },
    { id: 'settings', label: 'Merge tool settings…', icon: Settings, run: () => openSettingsDialogAt('merge') },
  ]);

  if (!primary) {
    return (
      <SplitButton
        variant={variant}
        icon={<FolderOpen size={13} />}
        menu={menu}
        menuLabel="More ways to resolve"
        tip={running ?? 'No merge tool found'}
        disabled={Boolean(running)}
        onClick={() => void addApp()}
      >
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
      tip={running}
      disabled={Boolean(running)}
      onClick={() => resolve(primary)}
    >
      Resolve in {primary.name}
    </SplitButton>
  );
}
