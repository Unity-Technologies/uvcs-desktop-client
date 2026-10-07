import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { PathLabel } from '../../components/PathLabel';
import { firstLine, formatCountAtLeast, pluralizeAtLeast } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import { Spinner } from '../../ui/Spinner';
import { collisionNote } from './collisionMessages';
import type { IncomingChipState } from './incomingChipState';
import { NEWEST_IN_CARD } from './useIncomingChangesets';
import styles from './IncomingCard.module.css';

interface IncomingCardProps {
  state: Extract<IncomingChipState, { kind: 'incoming' | 'conflicts' }>;
  /** The newest `NEWEST_IN_CARD` changesets, undefined while they load. */
  newest: Changeset[] | undefined;
  actions: React.ReactNode;
}

/** The incoming changesets at a glance: who, what and when, and whether they collide with local changes. */
export function IncomingCard({ state, newest, actions }: IncomingCardProps) {
  const changesets = newest?.slice(0, NEWEST_IN_CARD) ?? [];
  const more = state.count - changesets.length;

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <ArrowDownToLine size={14} className={styles.headerIcon} />
        <span className={styles.title}>{pluralizeAtLeast(state.count, state.countCapped, 'new changeset')}</span>
        <span className={styles.branch}>
          on <PathLabel path={state.branch} fitContent />
        </span>
      </header>
      {state.kind === 'conflicts' && (
        <p className={styles.conflicts}>
          <AlertTriangle size={14} className={styles.conflictsIcon} />
          <span>{collisionNote(state.mergeCount, state.blockedCount)}</span>
        </p>
      )}
      <ul className={styles.list}>
        {!newest && (
          <li className={styles.loading}>
            <Spinner size={12} /> Loading changesets…
          </li>
        )}
        {changesets.map((changeset) => (
          <li key={changeset.id} className={styles.changeset}>
            <Avatar user={changeset.owner} size={20} />
            <span className={styles.text}>
              <span className={styles.comment}>{firstLine(changeset.comment) || 'No comment'}</span>
              <span className={styles.meta}>
                cs:{changeset.id} · {displayName(changeset.owner)} · <RelativeTime date={changeset.date} />
              </span>
            </span>
          </li>
        ))}
        {changesets.length > 0 && more > 0 && <li className={styles.more}>and {formatCountAtLeast(more, state.countCapped)} more</li>}
      </ul>
      <footer className={styles.footer}>{actions}</footer>
    </div>
  );
}
