import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { pluralize } from '../../../lib/text';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from './fileConflictDecision';

/**
 * The menu entries of the selected conflicting files that settle them by keeping one version whole, as a file's
 * toolbar's "Keep" does (`KeepChoices`): "Keep yours", "Keep incoming" (the sides' names, `MergeLabels.roles`), "for
 * 3 files" when several are. None without conflicting files.
 */
export function keepVersionEntries(conflictKeys: string[], labels: MergeLabels, decide: (key: string, decision: FileConflictDecision) => void): GroupedEntry[] {
  if (conflictKeys.length === 0) return [];
  const keep = (side: 'source' | 'destination') => () => {
    for (const key of conflictKeys) decide(key, { kind: 'wholeFile', side });
  };
  const forFiles = conflictKeys.length > 1 ? ` for ${pluralize(conflictKeys.length, 'file')}` : '';
  return [
    menuAction('keepDestination', keep('destination'), { label: `Keep ${labels.roles.destination.name.toLowerCase()}${forFiles}` }),
    menuAction('keepSource', keep('source'), { label: `Keep ${labels.roles.source.name.toLowerCase()}${forFiles}` }),
  ];
}
