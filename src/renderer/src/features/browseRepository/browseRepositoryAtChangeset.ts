import { navigation } from '../../app/navigation/navigationStore';
import { prompt } from '../../ui/dialog/prompt';

/** Asks for a changeset and browses the repository as it was there. */
export async function browseRepositoryAtChangeset(): Promise<void> {
  const answer = await prompt({ title: 'Browse repository', label: 'Changeset number', confirmLabel: 'Browse' });
  const changesetId = Number.parseInt(answer ?? '', 10);
  if (Number.isInteger(changesetId) && changesetId >= 0) navigation.openPage({ kind: 'browseRepository', changesetId });
}
