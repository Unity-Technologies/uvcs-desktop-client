import { useMemo } from 'react';
import { usePlaceServer } from '../../app/workspace/useWorkspace';
import { useMemberNames } from '../permissions/permissionsQueries';
import { NO_GROUPS, reviewerGroups, type ReviewerGroups } from './reviewerGroups';

/**
 * The groups of the place's server, which tell group reviewers from users: one `cm listusers --onlygroups` for the
 * session, the one the reviewer picker and Permissions read. Every reviewer reads as a user until it answers, and
 * when the server can't list its groups.
 */
export function useReviewerGroups(): ReviewerGroups {
  const server = usePlaceServer() ?? '';
  const { data } = useMemberNames(server, 'group', { enabled: server !== '' });
  return useMemo(() => (data ? reviewerGroups(data) : NO_GROUPS), [data]);
}
