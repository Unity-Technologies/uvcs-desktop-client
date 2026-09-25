import type { ProgressReader } from './progressReader';

/**
 * `cm shelveset create` (without `--summaryformat`, which silences it) prints the checkin stage as it changes, then the
 * shelved items and the shelve: `Uploading file data` · `Confirming checkin operation` · `Modified /w/a.txt` ·
 * `Created shelve sh:2@repo@server (mount:'/')`. No bytes, and localized words: the first stage uploads, the next one
 * confirms, and lines with paths are the report.
 */
export const readShelveProgress: ProgressReader = (previous, line) => {
  const text = line.trim();
  if (!text || /[\\/]/.test(text)) return previous;
  return previous
    ? { stage: 'confirming', stageLabel: 'Confirming', fraction: null, cancellable: false }
    : { stage: 'uploading', stageLabel: 'Uploading', fraction: null, cancellable: true };
};
