import { changesetSpanSummary, type ChangesetListChoice } from '../../components/changesetList/changesetListChoice';

/**
 * What Incoming's files are, for screen readers: the whole update's, a changeset's or several changesets'. On screen,
 * the row selected in the list above says it, as in a branch diff, and the update bar says what updating does.
 */
export function incomingFilesLabel(choice: ChangesetListChoice): string {
  if (choice.kind === 'span') return `Files changed in ${changesetSpanSummary(choice.changesets).ends}`;
  if (choice.kind === 'changeset') return `Files changed in cs:${choice.changesetId}`;
  return 'Incoming files';
}
