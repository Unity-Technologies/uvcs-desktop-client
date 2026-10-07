import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { PathLabel } from '../../components/PathLabel';
import { firstLine, formatCountAtLeast, pluralizeAtLeast } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import { Spinner } from '../../ui/Spinner';
import { collisionNote } from './collisionMessages';
import type { CardCheck, IncomingChipState } from './incomingChipState';
import styles from './IncomingCard.module.css';

const CHECK_WORDS: Record<NonNullable<CardCheck>, string> = {
  unchecked: 'Click to check them against your changes. Updating or opening Incoming checks too.',
  checking: 'Checking against your changes…',
  failed: "Couldn't check them against your changes",
};

interface IncomingCardProps {
  state: Extract<IncomingChipState, { kind: 'incoming' | 'conflicts' }>;
  /** The newest changesets (`cardChangesets`), undefined while they load. */
  changesets: Changeset[] | undefined;
  /** They couldn't be read (`cardFailed`). */
  failed: boolean;
  /** Past the check's count, where checking the incoming changes against the local ones stands (`cardCheck`). */
  check: CardCheck;
  actions: React.ReactNode;
}

/** The incoming changesets at a glance: who, what and when, and whether they collide with local changes. */
export function IncomingCard({ state, changesets, failed, check, actions }: IncomingCardProps) {
  const more = state.count - (changesets?.length ?? 0);

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <ArrowDownToLine size={14} className={styles.headerIcon} />
        <span className={styles.title}>{pluralizeAtLeast(state.count, state.countCapped, 'new changeset')}</span>
        <span className={styles.branch}>
          on <PathLabel path={state.branch} fitContent />
        </span>
      </header>
      {check && <p className={styles.unchecked}>{CHECK_WORDS[check]}</p>}
      {state.kind === 'conflicts' && (
        <p className={styles.conflicts}>
          <AlertTriangle size={14} className={styles.conflictsIcon} />
          <span>{collisionNote(state.mergeCount, state.blockedCount)}</span>
        </p>
      )}
      <ul className={styles.list}>
        {!changesets && (
          <li className={styles.loading}>
            {failed ? (
              "Couldn't read the changesets"
            ) : (
              <>
                <Spinner size={12} /> Loading changesets…
              </>
            )}
          </li>
        )}
        {changesets?.map((changeset) => (
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
        {changesets && changesets.length > 0 && more > 0 && <li className={styles.more}>and {formatCountAtLeast(more, state.countCapped)} more</li>}
      </ul>
      <footer className={styles.footer}>{actions}</footer>
    </div>
  );
}
