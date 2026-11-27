import { X } from 'lucide-react';
import type { Command } from '../../../../app/commands/commandStore';
import { hotkey } from '../../../../lib/shortcutRegistry';
import { SHORTCUTS, type ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { leaveCommentCommandOf, type LeaveCommentCommand, type StageCommenting } from './stageCommenting';

/** The stage's Esc in the registry: its key, and its area ("Image diff", "Model diff") as the palette's group. */
export type LeaveCommentShortcutId = Extract<ShortcutId, 'imageCommentLeave' | 'modelCommentLeave'>;

export interface LeaveCommentInput {
  shortcut: LeaveCommentShortcutId;
  state: StageCommenting;
  /** The diff shows (`ViewShownContext`): not behind its review's conversation, nor under a page. */
  shown: boolean;
  apply: (action: LeaveCommentCommand['action']) => void;
}

/**
 * Esc wherever the keyboard is in the diff, as a command (`leaveCommentCommandOf`): one while there's a spot being
 * marked or a card open, else none. None rather than one `disabled`: every image and model viewer in the app (History,
 * Files, a merge) registers under the same id, and the commands keep one per id, the last mounted (`registeredCommands`),
 * so an idle viewer mounted later would mask the one with a card open.
 */
export function leaveCommentCommands({ shortcut, state, shown, apply }: LeaveCommentInput): Command[] {
  const command = leaveCommentCommandOf(state, shown);
  if (!command) return [];
  return [
    {
      id: `diff.${shortcut}`,
      group: SHORTCUTS[shortcut].area,
      label: command.label,
      icon: X,
      shortcut: hotkey(shortcut),
      run: () => apply(command.action),
    },
  ];
}
