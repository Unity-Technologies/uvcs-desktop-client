import type { CommandProgress } from '@shared/domain/operation';
import type { ProgressReader } from './progressReader';
import { parseSize } from './sizes';

/**
 * `cm update` and `cm switch` with `--forcedetailedprogress` (and without `--machinereadable`, which turns it off) print
 * a few sentences while they get ready, then rewrite one progress line every 200 ms (`UpdateProgressBuilder`):
 *
 *   `- Updating       [###.................]  17%   55.68/319.56 MB -   1/506 files`
 *
 * The status word and "files" are localized, and sizes use the culture's decimal separator, so only the shape is read:
 * spinner, status, bar, percentage, then sizes and files once the totals are known (not while calculating).
 */
const PROGRESS_LINE = /^[-\\|/] .+?\s+\[[#.]+\]\s+\d+%(.*)$/;
const TOTALS = /^\s+([\d.,]+)\/([\d.,]+) (\S+) -\s+(\d+)\/(\d+)(?:\s+\S+)?(?: - (.*))?$/;

const PREPARING: CommandProgress = { stage: 'preparing', stageLabel: 'Preparing', fraction: null, cancellable: true };
const CALCULATING: CommandProgress = { stage: 'calculating', stageLabel: 'Calculating changes', fraction: null, cancellable: true };

export const readUpdateProgress: ProgressReader = (previous, line) => {
  const trimmed = line.trimEnd();
  const progressLine = PROGRESS_LINE.exec(trimmed);
  if (!progressLine) {
    // The sentences before the progress line ("Setting the new selector…"), or the report after it.
    if (!trimmed.trim()) return previous;
    return previous && previous.stage !== 'preparing' ? previous : PREPARING;
  }

  const totals = TOTALS.exec(progressLine[1]!);
  if (!totals) return CALCULATING;

  const bytesDone = parseSize(totals[1]!, totals[3]!);
  const bytesTotal = parseSize(totals[2]!, totals[3]!);
  const current = Number(totals[4]);
  const total = Number(totals[5]);
  const fraction = workDone(bytesDone ?? 0, bytesTotal ?? 0, current, total);
  const finished = current >= total && (bytesDone ?? 0) >= (bytesTotal ?? 0);
  return {
    // Files are being written from here on: stopping halfway would leave the workspace half updated.
    ...(finished ? { stage: 'finishing', stageLabel: 'Finishing', fraction: 1 } : { stage: 'downloading', stageLabel: 'Downloading', fraction }),
    current,
    total,
    bytesDone,
    bytesTotal,
    currentItem: totals[6]?.trim() || undefined,
    cancellable: false,
  };
};

/**
 * What writing a file costs besides its bytes, as if it weighed this much more. `cm`'s own percentage goes by bytes
 * alone, and it downloads the big files first: with one big file among thousands of small ones it reads 99% while it
 * has written 1 of 8,001 files, then spends most of the time writing the small ones (real output in the tests).
 */
const FILE_WEIGHT = 128 * 1024;

/** How far along an update is, by bytes and files together: both only grow, so it never goes back. */
function workDone(bytesDone: number, bytesTotal: number, current: number, total: number): number | null {
  const all = bytesTotal + total * FILE_WEIGHT;
  if (!all) return null;
  return Math.min(1, (Math.min(bytesDone, bytesTotal) + Math.min(current, total) * FILE_WEIGHT) / all);
}
