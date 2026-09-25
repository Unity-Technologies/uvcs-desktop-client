import type { Annotation, AnnotationChangeset } from '@shared/domain/annotate';

export interface AnnotationRow {
  changeset: AnnotationChangeset;
  /** First line of a run of consecutive lines from the same changeset; only it shows the details. */
  isBlockStart: boolean;
  /** 0 for the oldest changeset in the file, 1 for the newest. */
  recency: number;
}

/** One row per line, in line order, with what the annotate gutter needs to draw it. */
export function buildAnnotationRows({ lines, changesets }: Annotation): AnnotationRow[] {
  const changesetsById = new Map(changesets.map((changeset) => [changeset.changesetId, changeset]));
  const recencyOf = recencyByChangeset(changesets);

  return lines.map((line, index) => ({
    changeset: changesetsById.get(line.changesetId)!,
    isBlockStart: index === 0 || lines[index - 1]!.changesetId !== line.changesetId,
    recency: recencyOf.get(line.changesetId) ?? 0,
  }));
}

/** Ranks changesets by date rather than scaling by time, so one very old line doesn't wash out the rest. */
function recencyByChangeset(changesets: AnnotationChangeset[]): Map<number, number> {
  const byDate = [...changesets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.changesetId - b.changesetId);
  const steps = Math.max(1, byDate.length - 1);
  return new Map(byDate.map((changeset, rank) => [changeset.changesetId, byDate.length === 1 ? 1 : rank / steps]));
}

export function distinctAuthors({ changesets }: Annotation): number {
  return new Set(changesets.map((changeset) => changeset.owner)).size;
}
