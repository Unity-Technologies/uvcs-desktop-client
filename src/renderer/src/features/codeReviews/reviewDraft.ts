import { spec } from '@shared/domain/specs';

export type ReviewTargetKind = 'branch' | 'changeset' | 'shelve';

/** What a new code review is about, as typed in its dialog. */
export interface ReviewTargetDraft {
  kind: ReviewTargetKind;
  /** Branch name (e.g. `/main/task`), changeset or shelve number. */
  value: string;
  /** A title to start from, e.g. the shelve's comment. */
  title?: string;
}

/** The spec `cm` takes for the target typed: a full branch name (`/main/task`) or a number; null for anything else. */
export function draftTargetSpec(kind: ReviewTargetKind, value: string): string | null {
  const typed = value.trim();
  if (kind === 'branch') return typed.startsWith('/') ? spec.branch(typed) : null;
  if (!/^\d+$/.test(typed)) return null;
  return kind === 'changeset' ? spec.changeset(Number(typed)) : spec.shelve(Number(typed));
}
