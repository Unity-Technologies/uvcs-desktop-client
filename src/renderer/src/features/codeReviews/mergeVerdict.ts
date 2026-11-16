import type { MergeCardSection } from './mergeCard';

/**
 * Whether a merge request can merge, from what is known of it: `ready` (every section passed or says nothing, one
 * passed), `blocked` (a section failed), or `waiting` (a review under way, or nobody reviews it yet). What its card's
 * discs say section by section, said once by a branch's name (merge-requests.md "A branch's merge request at a glance").
 */
export type MergeVerdict = 'ready' | 'blocked' | 'waiting';

export const VERDICT_WORDS: Record<MergeVerdict, string> = { ready: 'Ready to merge', blocked: 'Not ready to merge', waiting: 'Waiting for review' };

/** The verdict over a card's sections: a failed one blocks; ready when the card is (`mergeReadiness`'s rule); else it waits. */
export function verdictOfSections(sections: readonly Pick<MergeCardSection, 'tone'>[]): MergeVerdict {
  if (sections.some((section) => section.tone === 'failed')) return 'blocked';
  const ready = sections.some((section) => section.tone === 'passed') && sections.every((section) => section.tone === 'passed' || section.tone === 'neutral');
  return ready ? 'ready' : 'waiting';
}
