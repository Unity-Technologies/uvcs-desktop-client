import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { MergeToolRule } from '@shared/domain/mergeTools';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';

export function removeRule(rules: readonly MergeToolRule[], id: string): MergeToolRule[] {
  return rules.filter((rule) => rule.id !== id);
}

/** The row moved one place up (-1) or down (1): earlier rows win. Nothing moves past the ends. */
export function moveRule(rules: readonly MergeToolRule[], id: string, offset: -1 | 1): MergeToolRule[] {
  const from = rules.findIndex((rule) => rule.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= rules.length) return [...rules];
  const moved = [...rules];
  [moved[from], moved[to]] = [moved[to]!, moved[from]!];
  return moved;
}

/**
 * A row's "…" menu: Edit…, then, for a rule, Move up, Move down (not past the ends) and Remove. Every other file's row
 * stays last, so it only edits.
 */
export function rowMenuEntries(rules: readonly MergeToolRule[], id: string | null, edit: () => void, save: (rules: MergeToolRule[]) => void): MenuEntry[] {
  const editEntry: MenuEntry = { id: 'edit', label: 'Edit…', icon: Pencil, run: edit };
  if (id === null) return [editEntry];
  const index = rules.findIndex((rule) => rule.id === id);
  return [
    editEntry,
    SEPARATOR,
    { id: 'moveUp', label: 'Move up', icon: ArrowUp, disabled: index <= 0, run: () => save(moveRule(rules, id, -1)) },
    { id: 'moveDown', label: 'Move down', icon: ArrowDown, disabled: index >= rules.length - 1, run: () => save(moveRule(rules, id, 1)) },
    SEPARATOR,
    { id: 'remove', label: 'Remove', icon: Trash2, danger: true, run: () => save(removeRule(rules, id)) },
  ];
}
