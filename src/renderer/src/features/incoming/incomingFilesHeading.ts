import type { Changeset } from '@shared/domain/changeset';
import type { ChangesetListChoice } from '../../components/changesetList/changesetListChoice';
import { changesetSpanSummary } from '../../components/changesetList/changesetListChoice';
import { commentLineText } from '../../lib/comments/commentText';

/** What the header over Incoming's files says they are, its tooltip, and the files' name for screen readers. */
export interface IncomingFilesHeading {
  title: string;
  tip?: string;
  listLabel: string;
  /** Some of the changesets show, not the whole update: ✕ goes back to it. */
  narrowed: boolean;
}

/**
 * "All incoming changes"; a changeset's number and comment, "cs:7 · Fix the jump"; or several changesets' count and
 * ends, "3 changesets · cs:6 to cs:8". `changeset`: the one the list selects, once it holds it.
 */
export function incomingFilesHeading(choice: ChangesetListChoice, changeset: Changeset | undefined): IncomingFilesHeading {
  if (choice.kind === 'span') {
    const { count, ends } = changesetSpanSummary(choice.changesets);
    return { title: `${count} · ${ends}`, listLabel: `Files changed in ${ends}`, narrowed: true };
  }
  if (choice.kind === 'changeset') {
    const comment = changeset ? commentLineText(changeset.comment) : '';
    return { title: `cs:${choice.changesetId} · ${comment || 'No comment'}`, tip: comment || undefined, listLabel: `Files changed in cs:${choice.changesetId}`, narrowed: true };
  }
  return { title: 'All incoming changes', listLabel: 'Incoming files', narrowed: false };
}
