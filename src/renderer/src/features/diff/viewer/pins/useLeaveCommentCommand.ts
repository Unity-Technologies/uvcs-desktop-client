import { useContext, useMemo, useRef } from 'react';
import { useCommands, type Command } from '../../../../app/commands/commandStore';
import { ViewShownContext } from '../../../../lib/viewShown';
import { leaveCommentCommands, type LeaveCommentInput } from './leaveCommentCommands';
import { leaveCommentCommandOf } from './stageCommenting';

const NO_COMMANDS: Command[] = [];

/**
 * Esc stops marking a comment's spot, or closes the comment's card open, wherever the keyboard is in the diff
 * (`leaveCommentCommands`), not only on the focused stage: a comment gone to from the Comments panel leaves the
 * keyboard there. A command, as Files' "Cancel the cut" is, so `CommandShortcuts` runs it only once nothing else took
 * the key (a field typed into, a menu or popover closing, a dialog) and Expand Diff's Esc waits for it.
 */
export function useLeaveCommentCommand({ shortcut, state, apply }: Omit<LeaveCommentInput, 'shown'>): void {
  const shown = useContext(ViewShownContext);
  const latestApply = useRef(apply);
  latestApply.current = apply;
  // Built anew only when what Esc does changes, not on every render.
  const action = leaveCommentCommandOf(state, shown)?.action;
  const commands = useMemo(
    () => (action ? leaveCommentCommands({ shortcut, state, shown, apply: (taken) => latestApply.current(taken) }) : NO_COMMANDS),
    [shortcut, action],
  );
  useCommands(commands);
}
