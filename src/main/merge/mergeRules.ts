import { RENAMEABLE_CONFLICTS, type MergePlan, type MergeResolutions } from '@shared/domain/merge';

const UNMERGEABLE_REASONS: Record<Exclude<MergePlan['status'], 'ready'>, string> = {
  pendingChanges: 'The workspace has pending changes. Check them in or shelve them before merging.',
  alreadyMerged: 'There is nothing to merge: the destination already has these changes.',
  invalidInterval: 'The changeset interval is not valid.',
};

/** Why a merge cannot run, or null when it can. */
export function describeUnmergeablePlan(plan: MergePlan): string | null {
  return plan.status === 'ready' ? null : UNMERGEABLE_REASONS[plan.status];
}

/** Refuses to merge unless every conflict has a valid decision, so no file is left half-merged. */
export function assertResolutionsComplete(plan: MergePlan, resolutions: MergeResolutions): void {
  if (resolutions.directoryConflicts.length !== plan.directoryConflicts.length) {
    throw new Error('Every directory conflict needs a decision before merging.');
  }

  plan.directoryConflicts.forEach((conflict, index) => {
    const resolution = resolutions.directoryConflicts[index]!;
    if (resolution.choice !== 'rename') return;
    if (!RENAMEABLE_CONFLICTS.has(conflict.type)) throw new Error(`${conflict.title}: keeping both items is not possible.`);
    if (!isValidFileName(resolution.newName)) throw new Error(`“${resolution.newName}” is not a valid name.`);
  });

  const unresolved = plan.fileConflicts.filter((conflict) => !resolutions.files[conflict.path]);
  if (unresolved.length > 0) throw new Error(`Resolve ${unresolved.map((conflict) => conflict.path).join(', ')} before merging.`);
}

function isValidFileName(name: string): boolean {
  return name.trim() !== '' && !/[\\/]/.test(name) && name !== '.' && name !== '..';
}
