import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from './fileConflictDecision';

/**
 * The menu entries of a conflicting file that settle it by keeping one version whole, as its toolbar's "Keep" does
 * (`KeepChoices`): "Keep yours", "Keep incoming" (the sides' names, `MergeLabels.roles`). None for anything else.
 */
export function keepVersionEntries(conflictKeys: string[], labels: MergeLabels, decide: (key: string, decision: FileConflictDecision) => void): GroupedEntry[] {
  if (conflictKeys.length !== 1) return [];
  const [key] = conflictKeys as [string];
  const keep = (side: 'source' | 'destination') => () => decide(key, { kind: 'wholeFile', side });
  return [
    menuAction('keepDestination', keep('destination'), { label: `Keep ${labels.roles.destination.name.toLowerCase()}` }),
    menuAction('keepSource', keep('source'), { label: `Keep ${labels.roles.source.name.toLowerCase()}` }),
  ];
}
