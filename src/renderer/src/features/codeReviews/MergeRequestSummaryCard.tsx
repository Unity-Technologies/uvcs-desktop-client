import type { ReactNode } from 'react';
import { displayName } from '../../lib/userName';
import { mergeRequestSummaryOf } from './mergeRequestSummary';
import type { MergeRequestReview } from './mergeRequestState';
import { MergeRequestStateBadge } from './MergeRequestStateBadge';
import { ReviewStanding } from './ReviewStanding';
import styles from './MergeRequestSummaryCard.module.css';

interface MergeRequestSummaryCardProps {
  request: MergeRequestReview;
  /** Makes the title a link that opens the request; a hover card whose trigger opens it leaves it as text. */
  onOpen?: () => void;
  /** More under the summary, e.g. the top bar's actions. */
  children?: ReactNode;
}

/**
 * A merge request at a glance (`mergeRequestSummaryOf` decides what it says): its title, who wants it merged where,
 * its state's badge and, under a rule, where its review stands. The hover cards of a branch's request and a branch's
 * details show it.
 */
export function MergeRequestSummaryCard({ request, onOpen, children }: MergeRequestSummaryCardProps) {
  const summary = mergeRequestSummaryOf(request);
  return (
    <div className={styles.summary}>
      <div className={styles.head}>
        {onOpen ? (
          <button type="button" className={styles.titleLink} onClick={onOpen}>
            {summary.title}
          </button>
        ) : (
          <p className={styles.title}>{summary.title}</p>
        )}
        <p className={styles.who}>
          <span className={styles.owner}>{displayName(summary.owner)}</span> {summary.verb} {summary.destination}
        </p>
        <span className={styles.badge}>
          <MergeRequestStateBadge state={summary.state} />
        </span>
      </div>
      {summary.review && (
        <div className={styles.review}>
          <ReviewStanding standing={summary.review} />
        </div>
      )}
      {children}
    </div>
  );
}
