import type { MergeCardSection } from './mergeCard';

/**
 * Whether a merge request can merge, from what is known of it: `ready` (every section passed or says nothing, one
 * passed), `blocked` (a section failed), or none while it waits (a review under way). What its card's discs say
 * section by section, said once by a branch's name (merge-requests.md "A branch's merge request at a glance").
 */
export type MergeVerdict = 'ready' | 'blocked';

export const VERDICT_WORDS: Record<MergeVerdict, string> = { ready: 'Ready to merge', blocked: 'Not ready to merge' };

/** The verdict over a card's sections: a failed one blocks; else ready when the card is (`mergeReadiness`'s rule). */
export function verdictOfSections(sections: readonly Pick<MergeCardSection, 'tone'>[]): MergeVerdict | undefined {
  if (sections.some((section) => section.tone === 'failed')) return 'blocked';
  const ready = sections.some((section) => section.tone === 'passed') && sections.every((section) => section.tone === 'passed' || section.tone === 'neutral');
  return ready ? 'ready' : undefined;
}
