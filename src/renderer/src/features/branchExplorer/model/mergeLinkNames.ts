import type { MergeLinkType } from '@shared/domain/branchExplorer';

export const MERGE_LINK_NAMES: Record<MergeLinkType, string> = {
  merge: 'Merge',
  cherryPick: 'Cherry pick',
  subtractive: 'Subtractive merge',
  interval: 'Interval merge',
  intervalCherryPick: 'Interval cherry pick',
  intervalSubtractive: 'Interval subtractive merge',
};
