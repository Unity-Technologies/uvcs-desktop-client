import { Bold, Code, Italic, Link, List, ListOrdered, ListTodo, SquareCode, Strikethrough, TextQuote, type LucideIcon } from 'lucide-react';
import type { ShortcutId } from '../../lib/shortcutRegistry';
import type { FormatCommandId } from './formatCommands';

/**
 * A format the comment editor offers (docs/features/rich-comments.md, "Writing"): what the selection bar, focus mode's
 * toolbar and the keys share. `FORMAT_COMMANDS` writes it.
 */
export interface FormatAction {
  id: FormatCommandId;
  /** Its tooltip, and its name for screen readers. */
  label: string;
  icon: LucideIcon;
  /** Its key in the registry, where the shortcuts sheet lists it. A task list has none, as in Slack. */
  shortcutId?: ShortcutId;
  /** Whether it formats whole lines, which a one-line field (a summary, a title) can't hold. */
  block: boolean;
}

export const FORMAT_ACTIONS: readonly FormatAction[] = [
  { id: 'bold', label: 'Bold', icon: Bold, shortcutId: 'commentBold', block: false },
  { id: 'italic', label: 'Italic', icon: Italic, shortcutId: 'commentItalic', block: false },
  { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, shortcutId: 'commentStrikethrough', block: false },
  { id: 'code', label: 'Code', icon: Code, shortcutId: 'commentCode', block: false },
  { id: 'link', label: 'Link', icon: Link, shortcutId: 'commentLink', block: false },
  { id: 'bullet', label: 'List', icon: List, shortcutId: 'commentList', block: true },
  { id: 'task', label: 'Task list', icon: ListTodo, block: true },
  { id: 'numbered', label: 'Numbered list', icon: ListOrdered, shortcutId: 'commentNumberedList', block: true },
  { id: 'quote', label: 'Quote', icon: TextQuote, shortcutId: 'commentQuote', block: true },
  { id: 'codeBlock', label: 'Code block', icon: SquareCode, shortcutId: 'commentCodeBlock', block: true },
];

/** The formats a field offers, to its keys and its selection bar: a one-line field the inline ones, a comment all. */
export function formatsOf(singleLine: boolean): readonly FormatCommandId[] {
  return FORMAT_ACTIONS.filter((action) => !singleLine || !action.block).map((action) => action.id);
}

/** Whether `id` is the first block format among those a bar shows, which a hairline sets off from the inline ones. */
export function startsBlocks(shown: readonly FormatAction[], id: FormatCommandId): boolean {
  return shown.find((action) => action.block)?.id === id;
}
