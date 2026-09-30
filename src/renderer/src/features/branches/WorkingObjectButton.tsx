import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { useRunningOperationOfKind } from '../../app/operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { SELECTOR_ICONS, workingObjectName } from '../../components/workingObject';
import { holdBackMenuKeyRelease, isListMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ringValue } from '../../app/operations/progressBar';
import { ProgressRing } from '../../ui/ProgressRing';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { BranchSwitcher } from './BranchSwitcher';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { useBranchCommands } from './useBranchCommands';
import { useBranchSwitcher } from './branchSwitcherStore';
import { useWorkingObject } from './useWorkingObject';
import { useWorkingObjectComment } from './useWorkingObjectComment';
import { workingObjectMenu } from './workingObjectMenu';
import styles from './WorkingObjectButton.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/** The widest the name and its comment get: 360px with the pill's icon, padding and chevron. */
const TEXT_MAX_WIDTH = 294;

/** Shows what the workspace is loaded from and lets the user switch branches; right-click for that object's menu. */
export function WorkingObjectButton() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const runningSwitch = useRunningOperationOfKind(workspacePath, 'switch');
  const { isOpen, setOpen } = useBranchSwitcher();
  const returnFocus = useReturnFocus(isOpen);
  useBranchCommands(workspace);

  const switching = runningSwitch?.title ?? null;
  const switchBar = runningSwitch?.bar ?? null;
  const SelectorIcon = SELECTOR_ICONS[workspace?.selector.kind ?? 'branch'];
  const title = workspace ? workingObjectTitle(workspace.selector) : '…';
  const { data: comment } = useWorkingObjectComment(workspace);
  const firstLine = comment?.split('\n', 1)[0]?.trim();
  // Right-click (or the context-menu key, Shift+F10) offers what the workspace is on, as its list does; what that
  // needs is read once the pointer or focus is on the pill.
  const [menuWanted, setMenuWanted] = useState(false);
  const workingObject = useWorkingObject(workspace, menuWanted);
  const wantMenu = (): void => setMenuWanted(true);

  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      <ActionContextMenu entries={() => (workspace ? workingObjectMenu(workspace, workingObject) : [])}>
        <Popover.Trigger asChild>
          <ToolbarPill
            onPointerEnter={wantMenu}
            onFocus={wantMenu}
            onKeyDown={(event) => {
              if (!isListMenuKey(event)) return;
              event.preventDefault();
              openContextMenuOf(event.currentTarget);
            }}
            onKeyUp={holdBackMenuKeyRelease}
            className={styles.trigger}
            textMaxWidth={TEXT_MAX_WIDTH}
            icon={switchBar ? <ProgressRing value={ringValue(switchBar)} size={14} /> : <SelectorIcon size={15} />}
            label={switching ? `${switching}…` : workspace?.selector.kind === 'branch' ? <PathLabel path={title} fitContent maxWidth={TEXT_MAX_WIDTH} tooltip={false} /> : title}
            sub={switching || comment === undefined ? undefined : firstLine || <span className={styles.noComment}>No comment</span>}
            data-tip={switching ? undefined : title}
            data-tip-sub={switching ? undefined : comment?.trim() || undefined}
            data-tip-shortcut={switching ? undefined : hotkey('switchBranch')}
            trailing={<ChevronDown size={14} className={styles.chevron} />}
          />
        </Popover.Trigger>
      </ActionContextMenu>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="start" sideOffset={6} {...returnFocus}>
          {workspace && <BranchSwitcher workspace={workspace} onDone={() => setOpen(false)} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The pill's first line: the branch name as is; `cs:42` and `sh:3` explain themselves, a bare label name doesn't. */
function workingObjectTitle(selector: WorkspaceSelector): string {
  const name = workingObjectName(selector);
  return selector.kind === 'label' ? `Label ${name}` : name;
}
