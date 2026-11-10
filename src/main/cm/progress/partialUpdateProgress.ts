import type { CommandProgress } from '@shared/domain/operation';
import type { ProgressReader } from './progressReader';
import { parseSize } from './sizes';
import { CALCULATING, PREPARING, workDone } from './updateProgress';

/**
 * `cm partial update` and `cm partial switch` print no progress bar: a line every second, either a bare word while they
 * calculate ("Calculating...", or "Updating..." when there is nothing to download) or what is done so far:
 *
 *   `Updated 116.26 MB of 243.76 MB (8 of 17 files to download / 8 of 33 operations to apply) - /Assets/rock.png`
 *
 * An update starts with a sentence ("Unity VCS is updating your workspace…"); a switch doesn't. The words are localized
 * and sizes use the culture's decimal separator, so only the shape is read: two sizes, then four counts in parentheses
 * (files done and to download, operations done and to apply), then the item being written.
 */
const TOTALS = /^\D*?([\d.,]+) (\S+) .*?([\d.,]+) (\S+) \((\D*\d+\D+\d+\D+\d+\D+\d+\D*)\)(?: - (.*))?$/;

const APPLYING_LABEL = 'Applying changes';

export const readPartialUpdateProgress: ProgressReader = (previous, line) => {
  const trimmed = line.trim();
  if (!trimmed) return previous;
  const totals = TOTALS.exec(trimmed);
  if (!totals) return bareLine(previous);

  const bytesDone = parseSize(totals[1]!, totals[2]!);
  const bytesTotal = parseSize(totals[3]!, totals[4]!);
  const [filesDone, files, operationsDone, operations] = totals[5]!.match(/\d+/g)!.map(Number) as [number, number, number, number];
  const downloaded = filesDone >= files && (bytesDone ?? 0) >= (bytesTotal ?? 0);
  const applied = operationsDone >= operations;
  return {
    // Files are being written from here on: stopping halfway would leave the workspace half updated.
    ...stageOf(downloaded, applied, workDone(bytesDone ?? 0, bytesTotal ?? 0, filesDone + operationsDone, files + operations)),
    current: filesDone,
    total: files,
    bytesDone,
    bytesTotal,
    currentItem: totals[6]?.trim() || undefined,
    cancellable: false,
  };
};

/** The update's first sentence prepares; later bare words calculate, unless the work already started. */
function bareLine(previous: CommandProgress | null): CommandProgress {
  if (!previous) return PREPARING;
  return previous.stage === 'preparing' || previous.stage === 'calculating' ? CALCULATING : previous;
}

function stageOf(downloaded: boolean, applied: boolean, fraction: number | null): Pick<CommandProgress, 'stage' | 'stageLabel' | 'fraction'> {
  if (downloaded && applied) return { stage: 'finishing', stageLabel: 'Finishing', fraction: 1 };
  if (downloaded) return { stage: 'applying', stageLabel: APPLYING_LABEL, fraction };
  return { stage: 'downloading', stageLabel: 'Downloading', fraction };
}
