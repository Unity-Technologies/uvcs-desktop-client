import { AppWindow, FolderOpen, PencilLine, Settings } from 'lucide-react';
import type { MergeTool } from '@shared/domain/mergeTools';
import { openSettingsDialogAt } from '../../../app/settings/SettingsDialog';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../../lib/actions';
import { SplitButton } from '../../../ui/SplitButton';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { addMergeTool } from './CustomMergeToolDialog';
import type { RunProgress } from './resolveRun';
import { otherTools, toolChoiceEntries } from './toolChoices';
import { useMergeToolFor, useMergeTools } from './useMergeTools';

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
  /** Why the text can't be edited in the app (`editInAppUnavailable`), shown on the entry; null when it can. */
  editInAppUnavailable?: string | null;
  variant?: 'primary' | 'secondary';
}

/**
 * "Resolve in <tool>", for a text file: the tool it opens in by Settings › Merge (`useMergeToolFor`), with the other
 * tools found behind the caret. Picking one there (or adding one) opens the file in it at once, this once: the settings
 * stay as they are.
 */
export function MergeToolButton({ state, actions, onEditInApp, editInAppUnavailable = null, variant = 'primary' }: MergeToolButtonProps) {
  const { tools } = useMergeTools();
  const primary = useMergeToolFor()(state);
  const resolve = (tool: MergeTool): void => actions.resolveIn(state.file.key, tool);
  const addAppAndResolve = async (): Promise<void> => {
    const added = await addMergeTool();
    if (added) resolve(added);
  };
  const running = actions.run ? `Resolving one by one in ${actions.run.toolName}` : undefined;

  const menu: MenuEntry[] = tidyMenu([
    ...toolChoiceEntries(
      otherTools(tools, primary).map((tool) => ({ tool, label: tool.name })),
      resolve,
    ),
    SEPARATOR,
    { id: 'addApp', label: 'Choose another app…', icon: FolderOpen, run: () => void addAppAndResolve() },
    {
      id: 'editInApp',
      label: 'Edit the text in the app',
      icon: PencilLine,
      run: onEditInApp,
      disabled: editInAppUnavailable !== null,
      disabledReason: editInAppUnavailable ?? undefined,
    },
    SEPARATOR,
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
        onClick={() => void addAppAndResolve()}
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
