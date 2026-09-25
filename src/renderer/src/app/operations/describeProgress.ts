import type { OperationProgress } from '@shared/domain/operation';

export interface ProgressText {
  /** Stable words and counts: "Downloading 124 of 530 files". Never a path. */
  stage: string;
  /** "28%", or null while it can't tell. */
  percent: string | null;
  /** "34 of 120 MB", or null when no bytes are involved. */
  amount: string | null;
}

const COUNTED: Partial<Record<OperationProgress['stage'], (current: string, total: string) => string>> = {
  downloading: (current, total) => `Downloading ${current} of ${total} files`,
  applying: (current, total) => `Applying ${current} of ${total} changes`,
};

/** What the progress card says about where an operation is. */
export function describeProgress(progress: OperationProgress | null): ProgressText {
  if (!progress) return { stage: 'Starting', percent: null, amount: null };
  const counted = COUNTED[progress.stage];
  // Counts go with a measured stage: a merge downloading its files still has its count of changes, all applied.
  const hasCounts = progress.fraction !== null && progress.current !== undefined && progress.total !== undefined && progress.total > 0;
  // A step says more than a command getting ready ("Switching" rather than "Preparing").
  const words = progress.step && progress.stage === 'preparing' ? progress.step.label : progress.stageLabel;
  return {
    stage: counted && hasCounts ? counted(formatCount(progress.current!), formatCount(progress.total!)) : words,
    percent: progress.fraction === null ? null : `${Math.floor(progress.fraction * 100)}%`,
    amount: progress.bytesTotal ? formatAmount(progress.bytesDone ?? 0, progress.bytesTotal) : null,
  };
}

/** A short line for tight places (the incoming chip): "43% · 0.8 of 1.9 GB", or the stage words. */
export function describeProgressBriefly(progress: OperationProgress | null): string {
  const text = describeProgress(progress);
  return text.percent ? `${text.percent} · ${text.amount ?? text.stage}` : text.stage;
}

/** What an operation did, from its last progress: "530 files updated · 1.9 GB", "1.9 GB uploaded", "12 changes applied". */
export function describeCompletion(progress: OperationProgress | null): string | null {
  if (!progress) return null;
  const { total, bytesTotal } = progress;
  if (total && bytesTotal) return `${countOf(total, 'file')} updated · ${formatBytes(bytesTotal)}`;
  if (bytesTotal) return `${formatBytes(bytesTotal)} uploaded`;
  if (total) return `${countOf(total, 'change')} applied`;
  return null;
}

const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'];

/**
 * "0.8 of 1.9 GB": both in the total's unit, so the text keeps its shape (and, with tabular digits, its width) while
 * the first number grows.
 */
export function formatAmount(done: number, total: number): string {
  const unit = unitOf(total);
  return `${scaled(Math.min(done, total), unit, total)} of ${scaled(total, unit, total)} ${UNITS[unit]}`;
}

export function formatBytes(bytes: number): string {
  const unit = unitOf(bytes);
  return `${scaled(bytes, unit, bytes)} ${UNITS[unit]}`;
}

function unitOf(bytes: number): number {
  let unit = 0;
  while (bytes >= 1024 ** (unit + 1) && unit < UNITS.length - 1) unit++;
  return unit;
}

/** One decimal while the total has a single digit in its unit ("1.9 GB"), none after ("120 MB"). */
function scaled(bytes: number, unit: number, total: number): string {
  const decimals = unit > 0 && total / 1024 ** unit < 10 ? 1 : 0;
  return (bytes / 1024 ** unit).toFixed(decimals);
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function countOf(count: number, singular: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : `${singular}s`}`;
}

/**
 * The file being worked on, relative to the workspace as the rest of the app shows paths. `cm` reports real paths,
 * so a workspace under a symlinked folder (/tmp on macOS is /private/tmp) matches through its real path too.
 */
export function itemInWorkspace(item: string, workspacePath: string): string {
  const path = item.replaceAll('\\', '/');
  const root = workspacePath.replaceAll('\\', '/').replace(/\/$/, '');
  for (const prefix of [root, `/private${root}`]) {
    if (path.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)) return path.slice(prefix.length + 1);
  }
  return path;
}
