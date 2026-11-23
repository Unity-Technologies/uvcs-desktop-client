import { X } from 'lucide-react';
import { useContext, useMemo, useRef } from 'react';
import { useCommands, type Command } from '../../../../app/commands/commandStore';
import { hotkey, type ShortcutId } from '../../../../lib/shortcutRegistry';
import { ViewShownContext } from '../../../../lib/viewShown';
import { leaveCommentCommandOf, type LeaveCommentCommand, type StageCommenting } from './stageCommenting';

/**
 * Esc stops marking a comment's spot, or closes the comment's card open, wherever the keyboard is in the diff
 * (`leaveCommentCommandOf`), not only on the focused stage: a comment gone to from the Comments panel leaves the
 * keyboard there. A command, as Files' "Cancel the cut" is, so `CommandShortcuts` runs it only once nothing else took
 * the key (a field typed into, a menu or popover closing, a dialog) and Expand Diff's Esc waits for it.
 */
export function useLeaveCommentCommand(shortcut: ShortcutId, state: StageCommenting, apply: (action: LeaveCommentCommand['action']) => void): void {
  const shown = useContext(ViewShownContext);
  const command = leaveCommentCommandOf(state, shown);
  const latestApply = useRef(apply);
  latestApply.current = apply;
  const commands = useMemo<Command[]>(
    () => [
      {
        id: `diff.${shortcut}`,
        group: 'Code review',
        label: command?.label ?? 'Close the comment',
        icon: X,
        shortcut: hotkey(shortcut),
        disabled: command === null,
        run: () => {
          if (command) latestApply.current(command.action);
        },
      },
    ],
    [shortcut, command?.action, command?.label],
  );
  useCommands(commands);
}
