import { navigation } from '../../app/navigation/navigationStore';
import { typedChangesetNumber } from '../../lib/changesetNumber';
import { prompt } from '../../ui/dialog/prompt';

/** Asks for a changeset (`12` or `cs:12`) and browses the repository as it was there. */
export async function browseRepositoryAtChangeset(): Promise<void> {
  const answer = await prompt({ title: 'Browse repository', label: 'Changeset number', confirmLabel: 'Browse' });
  const changesetId = typedChangesetNumber(answer ?? '');
  if (changesetId !== undefined) navigation.openPage({ kind: 'browseRepository', changesetId });
}
