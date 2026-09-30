import type { OperationProgress } from '@shared/domain/operation';
import { formatCount, pluralize } from '../../lib/text';

export interface ProgressText {
  /** Stable words and counts: "Downloading 124 of 530 files". Never a path. */
  stage: string;
  /** "28%", or null while it can't tell. */
  percent: string | null;
  /** "34 of 120 MB", or null when no bytes are involved. */
  amount: string | null;
  /** "124 of 530 files", or null when nothing is counted. */
  count: string | null;
}

const COUNTED: Partial<Record<OperationProgress['stage'], { verb: string; noun: string }>> = {
  downloading: { verb: 'Downloading', noun: 'files' },
  applying: { verb: 'Applying', noun: 'changes' },
};

/**
 * What the progress card says about where an operation is. An update's percentage weighs bytes and files together
 * (`updateProgress`), so it can sit between "0.8 of 0.8 GB" and "1 of 8,001 files": where both show, they show together.
 */
export function describeProgress(progress: OperationProgress | null): ProgressText {
  if (!progress) return { stage: 'Starting', percent: null, amount: null, count: null };
  const counted = COUNTED[progress.stage];
  // Counts go with a measured stage: a merge downloading its files still has its count of changes, all applied.
  const hasCounts = progress.fraction !== null && progress.current !== undefined && progress.total !== undefined && progress.total > 0;
  const count = counted && hasCounts ? `${formatCount(progress.current!)} of ${formatCount(progress.total!)} ${counted.noun}` : null;
  // A step says more than a command getting ready ("Switching" rather than "Preparing").
  const words = progress.step && progress.stage === 'preparing' ? progress.step.label : progress.stageLabel;
  return {
    stage: counted && count ? `${counted.verb} ${count}` : words,
    percent: progress.fraction === null ? null : `${Math.floor(progress.fraction * 100)}%`,
    amount: progress.bytesTotal ? formatAmount(progress.bytesDone ?? 0, progress.bytesTotal) : null,
    count,
  };
}

/** Everything measured, for a tooltip: "0.8 of 1.9 GB · 124 of 1,530 files", or null. */
export function describeMeasures(text: ProgressText): string | null {
  return [text.amount, text.count].filter(Boolean).join(' · ') || null;
}

/** A short line for tight places (the incoming chip): "43% · 124 of 1,530 files", "43% · 0.8 of 1.9 GB", or the stage words. */
export function describeProgressBriefly(progress: OperationProgress | null): string {
  const text = describeProgress(progress);
  if (!text.percent) return text.stage;
  // Files rather than bytes when there are both: bytes alone ("0.8 of 0.8 GB") would contradict the percentage.
  return `${text.percent} · ${text.amount && text.count ? text.count : (text.amount ?? text.stage)}`;
}

/** What an operation did, from its last progress: "530 files updated · 1.9 GB", "1.9 GB uploaded", "12 changes applied". */
export function describeCompletion(progress: OperationProgress | null): string | null {
  if (!progress) return null;
  const { total, bytesTotal } = progress;
  if (total && bytesTotal) return `${pluralize(total, 'file')} updated · ${formatBytes(bytesTotal)}`;
  if (bytesTotal) return `${formatBytes(bytesTotal)} uploaded`;
  if (total) return `${pluralize(total, 'change')} applied`;
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

function formatBytes(bytes: number): string {
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
