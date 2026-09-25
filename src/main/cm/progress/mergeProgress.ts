import { MERGE_FIELD_SEPARATOR } from '../mergeOutput';
import type { ProgressReader } from './progressReader';

/** Records of the plan `cm merge --merge --machinereadable` prints first: each is one change it's going to apply. */
const PLANNED = new Set(['APPLY', 'FILE_SRC', 'FILE_CONFLICT']);
/** Records printed as each change is applied, with its path. */
const APPLIED = new Set(['DO_MERGE', 'DO_COPIED', 'DO_MOVED', 'DO_DELETED']);

/**
 * Counts the changes applied against the plan printed before them. The records come as the items are set up, in a
 * burst; the content of added and changed files downloads after the last one, silently, and usually takes longest.
 */
export const readMergeProgress: ProgressReader = (previous, line) => {
  const [record, path] = line.split(MERGE_FIELD_SEPARATOR);
  if (PLANNED.has(record!)) {
    return { stage: 'calculating', stageLabel: 'Calculating changes', current: 0, total: (previous?.total ?? 0) + 1, fraction: null, cancellable: true };
  }
  if (!APPLIED.has(record!)) return previous;

  const total = previous?.total ?? 0;
  const current = Math.min(total, (previous?.current ?? 0) + 1);
  // Stopping now would leave a merge half applied.
  if (total > 0 && current >= total) return { stage: 'downloading', stageLabel: 'Downloading files', current, total, fraction: null, cancellable: false };
  return { stage: 'applying', stageLabel: 'Applying changes', current, total, fraction: total ? current / total : null, currentItem: path, cancellable: false };
};
