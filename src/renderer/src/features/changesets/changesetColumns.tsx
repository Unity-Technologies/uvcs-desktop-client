import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { shortBranchName } from '@shared/domain/specs';
import { authorColumn, avatarColumn, commentColumn, dateColumn, numberColumn, secondaryColumn } from '../../components/historyColumns';
import { LabelChips } from '../../components/LabelChips';
import type { Column } from '../../ui/table/DataTable';
import styles from './ChangesetsView.module.css';

/** Columns of the changesets table; `loadedChangeset` is highlighted as the workspace's current one. */
export function changesetColumns(loadedChangeset: number | undefined, labelsByChangeset: ReadonlyMap<number, readonly Label[]>): Column<Changeset>[] {
  return [
    avatarColumn(),
    numberColumn('Changeset', (changeset) => changeset.id === loadedChangeset && <span className={styles.current} data-tip="Loaded in your workspace" />),
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
