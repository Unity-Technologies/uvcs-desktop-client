import type { ReviewEventChange } from '@shared/domain/reviewConversation';
import { displayName } from '../../../lib/userName';

/** What an event says after its author's name: "requested a review from Ana and QA Team". */
export function reviewEventText(change: ReviewEventChange): string {
  switch (change.kind) {
    case 'reviewRequested':
      return change.reviewers.length === 0 ? 'requested a review' : `requested a review from ${listed(change.reviewers.map(displayName))}`;
    case 'reviewRequestedAgain':
      return change.reviewer ? `asked ${displayName(change.reviewer)} to review it again` : 'asked for a review again';
    case 'reviewerRemoved':
      return `removed ${displayName(change.reviewer)} from the reviewers`;
    case 'statusChanged':
      return STATUS_WORDS[change.status];
    case 'titleChanged':
      return `renamed it from “${change.from}” to “${change.to}”`;
    case 'other':
      return change.text;
  }
}

const STATUS_WORDS = {
  'Under review': 'marked it Under review',
  Reviewed: 'marked it Reviewed',
  'Rework required': 'asked for rework',
} as const;

function listed(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
