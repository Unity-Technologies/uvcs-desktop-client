import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { shortBranchName } from '@shared/domain/specs';
import { LabelChips } from '../../components/LabelChips';
import { firstLine } from '../../lib/text';
import { Avatar, UserLabel } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/DataTable';
import styles from './ChangesetsView.module.css';

/** Columns of the changesets table; `loadedChangeset` is highlighted as the workspace's current one. */
export function changesetColumns(loadedChangeset: number | undefined, labelsByChangeset: ReadonlyMap<number, readonly Label[]>): Column<Changeset>[] {
  return [
    {
      id: 'avatar',
      header: '',
      width: 34,
      render: (changeset) => <Avatar user={changeset.owner} size={20} />,
    },
    {
      id: 'id',
      header: 'Changeset',
      width: 84,
      sortValue: (changeset) => changeset.id,
      render: (changeset) => (
        <span className={styles.changesetId}>
          <Highlight text={String(changeset.id)} />
          {changeset.id === loadedChangeset && <span className={styles.current} data-tip="Loaded in your workspace" />}
        </span>
      ),
    },
    {
      id: 'comment',
      header: 'Comment',
      grow: 3,
      render: (changeset) => (
        <span className={styles.commentCell}>
          <LabelChips labels={labelsByChangeset.get(changeset.id)} />
          {firstLine(changeset.comment) ? (
            <span className={styles.comment}>
              <Highlight text={firstLine(changeset.comment)} />
            </span>
          ) : (
            <span className={styles.noComment}>No comment</span>
          )}
        </span>
      ),
    },
    {
      id: 'branch',
      header: 'Branch',
      width: 130,
      secondary: true,
      hideBelow: 560,
      sortValue: (changeset) => changeset.branch,
      render: (changeset) => (
        <span data-tip-overflow data-tip={changeset.branch}>
          <Highlight text={shortBranchName(changeset.branch)} />
        </span>
      ),
    },
    { id: 'owner', header: 'Author', width: 150, hideBelow: 700, sortValue: (changeset) => changeset.owner, render: (changeset) => <UserLabel user={changeset.owner} avatar={false} /> },
    {
      id: 'date',
      header: 'Date',
      width: 110,
      secondary: true,
      sortValue: (changeset) => changeset.date,
      render: (changeset) => <RelativeTime date={changeset.date} />,
    },
  ];
}
