import type { Page } from '../../app/navigation/pages';
import { branchDiffPage } from '../branches/branchOperations';
import { changesetDiffPage } from '../changesets/changesetOperations';
import { labelDiffPage } from '../labels/labelOperations';
import type { FollowedObject } from './model/followedObject';

/** The page a window following the Branch Explorer's selection shows, its details shown or not: the diff the views show for it. */
export function followedPage(followed: FollowedObject | null): Page | null {
  switch (followed?.kind) {
    case 'label':
      return labelDiffPage(followed.label);
    case 'changeset':
      return changesetDiffPage({ id: followed.id });
    case 'branch':
      return branchDiffPage(followed.branch);
    default:
      return null;
  }
}
