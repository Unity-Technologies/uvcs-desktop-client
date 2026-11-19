import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRunningOperationOfKind } from '../../app/operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { SELECTOR_ICONS } from '../../components/workingObject';
import { holdBackMenuKeyRelease, isListMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ringValue } from '../../app/operations/progressBar';
import { ProgressRing } from '../../ui/ProgressRing';
import { SkeletonLine } from '../../ui/Skeleton';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { MergeRequestChip, useWorkspaceMergeRequest } from '../codeReviews/MergeRequestChip';
import { BranchSwitcher } from './BranchSwitcher';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { useWorkspacePreview } from '../../app/shell/useWorkspacePreview';
import { shownWorkspace } from '../../app/shell/workspacePreview';
import { useBranchCommands } from './useBranchCommands';
import { useBranchSwitcher } from './branchSwitcherStore';
import { useWorkingObject } from './useWorkingObject';
import { useWorkingObjectComment } from './useWorkingObjectComment';
import { workingObjectCommentLine } from './workingObjectCommentLine';
import { workingObjectLabel } from './workingObjectLabel';
import { workingObjectMenu } from './workingObjectMenu';
import styles from './WorkingObjectButton.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/** The widest the name and its comment get: 360px with the pill's icon, padding and chevron. */
const TEXT_MAX_WIDTH = 294;

/** While the branch or its comment is unknown, bars about as wide as a typical one's. */
const NAME_PLACEHOLDER_WIDTH = 120;
const COMMENT_PLACEHOLDER_WIDTH = 180;

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
  const { selector } = shownWorkspace(workspace, useWorkspacePreview(workspacePath));
  const SelectorIcon = SELECTOR_ICONS[selector?.kind ?? 'branch'];
  const label = workingObjectLabel(switching, selector);
  const title = label.kind === 'branch' || label.kind === 'other' ? label.title : undefined;
  const { data: comment, isError: commentFailed } = useWorkingObjectComment(workspace);
  const commentLine = workingObjectCommentLine(comment, commentFailed, switching !== null);
  // Right-click (or the context-menu key, Shift+F10) offers what the workspace is on, as its list does; what that
  // needs is read once the pointer or focus is on the pill.
  const [menuWanted, setMenuWanted] = useState(false);
  const workingObject = useWorkingObject(workspace, menuWanted);
  const wantMenu = (): void => setMenuWanted(true);
  const mergeRequest = useWorkspaceMergeRequest();
  const branchName = (
    <span className={styles.name}>
      <PathLabel path={title ?? ''} fitContent maxWidth={TEXT_MAX_WIDTH} tooltip={false} />
    </span>
  );

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
            label={
              label.kind === 'switching' ? (
                label.text
              ) : label.kind === 'loading' ? (
                <SkeletonLine width={`${NAME_PLACEHOLDER_WIDTH}px`} />
              ) : label.kind === 'branch' ? (
                <span className={styles.nameLine}>
                  {branchName}
                  {mergeRequest && <MergeRequestChip {...mergeRequest} />}
                </span>
              ) : (
                label.title
              )
            }
            sub={
              commentLine.kind === 'loading' ? (
                <SkeletonLine width={`${COMMENT_PLACEHOLDER_WIDTH}px`} />
              ) : commentLine.kind === 'noComment' ? (
                <span className={styles.noComment}>No comment</span>
              ) : commentLine.kind === 'text' ? (
                commentLine.text
              ) : undefined
            }
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
