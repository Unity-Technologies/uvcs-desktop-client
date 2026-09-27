import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { DiffTarget } from '@shared/domain/diff';

export function describeTarget(target: CodeReviewTarget): string {
  switch (target.kind) {
    case 'branch':
      return target.branch;
    case 'changeset':
      return `Changeset ${target.changesetId}`;
    case 'shelve':
      return `Shelve ${target.shelveId}`;
    case 'unknown':
      return target.description;
  }
}

/** What to diff to review the changes, or null when the target is unknown. */
export function reviewDiffTarget(target: CodeReviewTarget): DiffTarget | null {
  switch (target.kind) {
    case 'branch':
      return { kind: 'branch', branch: target.branch };
    case 'changeset':
      return { kind: 'changeset', changesetId: target.changesetId };
    case 'shelve':
      return { kind: 'shelve', shelveId: target.shelveId };
    case 'unknown':
      return null;
  }
}
