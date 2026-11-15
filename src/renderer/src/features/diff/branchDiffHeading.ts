import type { ChangesetListChoice } from '../../components/changesetList/changesetListChoice';
import { changesetSpanSummary } from '../../components/changesetList/changesetListChoice';

/**
 * The words before the branch's name in a branch diff's header, for what its list of changesets selects: "All changes
 * on", "Changes in cs:1234 on", "Changes in cs:15 to cs:17 on". One line whatever is selected, so picking a changeset
 * changes the words and moves nothing; the changeset's own summary sits above its diff (`TargetDiff`'s
 * `pageDescription`).
 */
export function branchDiffHeading(choice: ChangesetListChoice): string {
  switch (choice.kind) {
    case 'all':
      return 'All changes on';
    case 'changeset':
      return `Changes in cs:${choice.changesetId} on`;
    case 'span':
      return `Changes in ${changesetSpanSummary(choice.changesets).ends} on`;
    case 'reading':
      return 'Changes on';
  }
}
