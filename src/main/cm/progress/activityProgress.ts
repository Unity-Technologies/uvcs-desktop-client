import type { ProgressReader } from './progressReader';

/**
 * Commands without a progress format of their own (push, pull, sync): their stage lines become the stage, their item
 * lines (`<U:/w/a.txt>`) the detail, and the rest is shown as is.
 */
export const readActivityProgress: ProgressReader = (previous, line) => {
  const trimmed = line.trim();
  if (!trimmed || /^(CI_START|CHANGESET )/.test(trimmed)) return previous;

  const item = /^<[A-Z]:(.*)>$/.exec(trimmed);
  if (item) return { ...working(previous?.stageLabel ?? 'Working'), currentItem: item[1] };

  const stage = /^<STAGE:(.*)>$/.exec(trimmed) ?? /^STAGE (.+)$/.exec(trimmed);
  const label = stage ? stage[1]!.trim() : trimmed;
  return label ? working(label) : previous;
};

function working(stageLabel: string) {
  return { stage: 'working', stageLabel, fraction: null } as const;
}
