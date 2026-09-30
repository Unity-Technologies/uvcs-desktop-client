import type { CommandProgress } from '@shared/domain/operation';
import type { ProgressReader } from './progressReader';
import { parseSize } from './sizes';

/**
 * `cm checkin --machinereadable` with redirected output (`CheckinCmd.RunCheckin`) prints `CI_START`, then a `STAGE` line
 * when the stage changes and every 5 s while uploading, with the bytes sent so far:
 *
 *   `STAGE Validating checkin data` · `STAGE Uploading file data 1.37 GB/1.87 GB` · `STAGE Confirming checkin operation` · `STAGE `
 *
 * The stage names are localized, so the order tells them apart: before any bytes it's getting ready, after them it's
 * confirming, and the empty `STAGE` ends the checkin.
 */
const STAGE = /^STAGE ?(.*)$/;
const UPLOADED = /([\d.,]+) (\S+)\/([\d.,]+) (\S+)$/;

const PREPARING: CommandProgress = { stage: 'preparing', stageLabel: 'Preparing', fraction: null, cancellable: true };

export const readCheckinProgress: ProgressReader = (previous, line) => {
  if (line === 'CI_START') return PREPARING;
  const stage = STAGE.exec(line);
  if (!stage) return previous;

  const text = stage[1]!.trim();
  if (!text) return { ...previous, stage: 'finishing', stageLabel: 'Finishing', fraction: null, cancellable: false };

  const uploaded = UPLOADED.exec(text);
  if (uploaded) {
    const bytesDone = parseSize(uploaded[1]!, uploaded[2]!) ?? 0;
    const bytesTotal = parseSize(uploaded[3]!, uploaded[4]!) ?? 0;
    // Nothing is committed until the server confirms: stopping while uploading leaves the changes as they were.
    return { stage: 'uploading', stageLabel: 'Uploading', bytesDone, bytesTotal, fraction: bytesTotal ? Math.min(1, bytesDone / bytesTotal) : 1, cancellable: true };
  }
  return previous?.bytesTotal !== undefined ? confirming(previous) : PREPARING;
};

/** The upload is done (all of it); the server is creating the changeset, which stopping now could leave half recorded. */
function confirming(previous: CommandProgress): CommandProgress {
  return { ...previous, stage: 'confirming', stageLabel: 'Confirming', bytesDone: previous.bytesTotal, fraction: null, cancellable: false };
}
