import type { ReactNode } from 'react';
import { firstLine } from '../lib/text';
import { Avatar, UserLabel } from '../ui/Avatar';
import { Highlight } from '../ui/Highlight';
import { RelativeTime } from '../ui/RelativeTime';
import type { Column } from '../ui/table/DataTable';
import styles from './historyColumns.module.css';

/**
 * The columns every list of recorded work shares (changesets, shelves), so they read alike: the author's avatar, the
 * number, the comment's first line, one secondary column of the list's own, the author and the date.
 */
export interface HistoryRow {
  id: number;
  owner: string;
  comment: string;
  date: string;
}

/**
 * Columns give way as the list narrows (a small window with the details open), so the comment keeps room to be read
 * and the list never scrolls sideways: the secondary column below 560 px, the author below 700, the avatar below 480
 * and, last, the date below 360. A list beside a diff (a branch's changesets) keeps the avatar at any width, as History
 * does: there it is the only way to tell who made each row.
 */
const HIDE_SECONDARY_BELOW = 560;
const HIDE_AUTHOR_BELOW = 700;
const HIDE_AVATAR_BELOW = 480;
const HIDE_DATE_BELOW = 360;

export function avatarColumn<Row extends HistoryRow>({ alwaysShown = false }: { alwaysShown?: boolean } = {}): Column<Row> {
  return { id: 'avatar', header: '', width: 34, hideBelow: alwaysShown ? undefined : HIDE_AVATAR_BELOW, render: (row) => <Avatar user={row.owner} size={20} /> };
}

/** The number, in mono; `marker` adds something after it (the changeset loaded in the workspace). */
export function numberColumn<Row extends HistoryRow>(header: string, marker?: (row: Row) => ReactNode): Column<Row> {
  return {
    id: 'id',
    header,
    width: 84,
    sortValue: (row) => row.id,
    render: (row) => (
      <span className={styles.numberCell}>
        <span className={styles.number}>
          <Highlight text={String(row.id)} />
        </span>
        {marker?.(row)}
      </span>
    ),
  };
}

/** The comment's first line; `chips` go before it (a changeset's labels). */
export function commentColumn<Row extends HistoryRow>(chips?: (row: Row) => ReactNode): Column<Row> {
  return {
    id: 'comment',
    header: 'Comment',
    grow: 3,
    render: (row) => (
      <span className={styles.commentCell}>
        {chips?.(row)}
        {firstLine(row.comment) ? (
          <span className={styles.clipped}>
            <Highlight text={firstLine(row.comment)} />
          </span>
        ) : (
          <span className={styles.noComment}>No comment</span>
        )}
      </span>
    ),
  };
}

/** A short secondary column (a branch, a base changeset): clipped, whole in its tooltip when it doesn't fit. */
export function secondaryColumn<Row extends HistoryRow>(
  id: string,
  header: string,
  { text, tip, sortValue }: { text: (row: Row) => string; tip?: (row: Row) => string; sortValue: (row: Row) => string | number },
): Column<Row> {
  return {
    id,
    header,
    width: 130,
    secondary: true,
    hideBelow: HIDE_SECONDARY_BELOW,
    sortValue,
    render: (row) => (
      <span className={styles.clipped} data-tip-overflow data-tip={(tip ?? text)(row)}>
        <Highlight text={text(row)} />
      </span>
    ),
  };
}

export function authorColumn<Row extends HistoryRow>(): Column<Row> {
  return { id: 'owner', header: 'Author', width: 150, hideBelow: HIDE_AUTHOR_BELOW, sortValue: (row) => row.owner, render: (row) => <UserLabel user={row.owner} avatar={false} /> };
}

export function dateColumn<Row extends HistoryRow>(): Column<Row> {
  return {
    id: 'date',
    header: 'Date',
    width: 110,
    secondary: true,
    hideBelow: HIDE_DATE_BELOW,
    sortValue: (row) => row.date,
    render: (row) => <RelativeTime date={row.date} />,
  };
}
