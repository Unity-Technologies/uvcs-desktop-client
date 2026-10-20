import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { pluralize } from '../../../lib/text';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision, KeptVersion } from './fileConflictDecision';

/** A conflicting file selected, and whether keeping its base is offered (`offersKeepBase`). */
export interface SelectedConflict {
  key: string;
  offersBase: boolean;
}

/**
 * The menu entries of the selected conflicting files that settle them by keeping one version whole, as a file's
 * toolbar's "Keep" does (`KeepChoices`): "Keep yours", "Keep incoming" (the sides' names, `MergeLabels.roles`) and,
 * when every one of them offers it (`offersKeepBase`), "Keep base"; "for 3 files" when several are. None without conflicting files.
 */
export function keepVersionEntries(conflicts: SelectedConflict[], labels: MergeLabels, decide: (key: string, decision: FileConflictDecision) => void): GroupedEntry[] {
  if (conflicts.length === 0) return [];
  const keep = (side: KeptVersion) => () => {
    for (const { key } of conflicts) decide(key, { kind: 'wholeFile', side });
  };
  const forFiles = conflicts.length > 1 ? ` for ${pluralize(conflicts.length, 'file')}` : '';
  return [
    menuAction('keepDestination', keep('destination'), { label: `Keep ${labels.roles.destination.name.toLowerCase()}${forFiles}` }),
    menuAction('keepSource', keep('source'), { label: `Keep ${labels.roles.source.name.toLowerCase()}${forFiles}` }),
    ...(conflicts.every((conflict) => conflict.offersBase) ? [menuAction('keepBase', keep('base'), { label: `Keep base${forFiles}` })] : []),
  ];
}
