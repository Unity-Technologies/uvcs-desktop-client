import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { shortBranchName } from '@shared/domain/specs';
import { authorColumn, avatarColumn, commentColumn, dateColumn, numberColumn, secondaryColumn } from '../../components/historyColumns';
import { LabelChips } from '../../components/LabelChips';
import { WorkspaceMark } from '../../components/WorkspaceMark';
import type { Column } from '../../ui/table/DataTable';

/** Columns of the changesets table; `loadedChangeset` is marked as the one the workspace is on. */
export function changesetColumns(loadedChangeset: number | undefined, labelsByChangeset: ReadonlyMap<number, readonly Label[]>): Column<Changeset>[] {
  return [
    avatarColumn(),
    numberColumn('Changeset', (changeset) => changeset.id === loadedChangeset && <WorkspaceMark on="changeset" />),
    commentColumn((changeset) => <LabelChips labels={labelsByChangeset.get(changeset.id)} />),
    secondaryColumn('branch', 'Branch', {
      text: (changeset) => shortBranchName(changeset.branch),
      tip: (changeset) => changeset.branch,
      sortValue: (changeset) => changeset.branch,
    }),
    authorColumn(),
    dateColumn(),
  ];
}
