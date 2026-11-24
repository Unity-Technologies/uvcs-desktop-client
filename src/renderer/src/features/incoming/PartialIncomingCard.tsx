import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { PathLabel } from '../../components/PathLabel';
import { pluralize } from '../../lib/text';
import { Spinner } from '../../ui/Spinner';
import type { IncomingChipState } from './incomingChipState';
import { morePartialItems, partialConflictNote, partialItemDetail, partialItemKey } from './partialIncomingItems';
import styles from './IncomingCard.module.css';

interface PartialIncomingCardProps {
  state: Extract<IncomingChipState, { kind: 'items' }>;
  /** The first items the comparison found (`cardItems`), undefined while they load. */
  items: PartialIncomingItem[] | undefined;
  actions: React.ReactNode;
}

/** A partial workspace's incoming items at a glance: which, what the branch did to them, and which you changed too. */
export function PartialIncomingCard({ state, items, actions }: PartialIncomingCardProps) {
  const more = morePartialItems(state.count, items);

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <ArrowDownToLine size={14} className={styles.headerIcon} />
        <span className={styles.title}>{pluralize(state.count, 'incoming item')}</span>
        <span className={styles.branch}>
          on <PathLabel path={state.branch} fitContent />
        </span>
      </header>
      {state.conflictCount > 0 && (
        <p className={styles.conflicts}>
          <AlertTriangle size={14} className={styles.conflictsIcon} />
          <span>{partialConflictNote(state.conflictCount)}</span>
        </p>
      )}
      <ul className={styles.list}>
        {!items && (
          <li className={styles.loading}>
            <Spinner size={12} /> Loading items…
          </li>
        )}
        {items?.map((item) => (
          <li key={partialItemKey(item)} className={styles.changeset}>
            <span className={styles.itemText}>
              <span className={styles.itemPath}>
                <PathLabel path={item.path} oldPath={item.oldPath} />
              </span>
              <span className={styles.meta}>{partialItemDetail(item)}</span>
            </span>
          </li>
        ))}
        {more > 0 && <li className={styles.more}>and {more} more</li>}
      </ul>
      <footer className={styles.footer}>{actions}</footer>
    </div>
  );
}
