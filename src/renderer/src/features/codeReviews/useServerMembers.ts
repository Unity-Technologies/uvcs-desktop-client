import type { MemberKind } from '@shared/domain/member';
import { useMemberNames } from '../permissions/permissionsQueries';
import { memberListing, type MemberListing } from './serverMembers';

/** The server's users or groups for the reviewer picker (`memberListing`): read whole once, or searched by `typed`. */
export function useServerMembers(server: string, kind: MemberKind, typed: string): MemberListing {
  const everyone = useMemberNames(server, kind, { enabled: server !== '' });
  const failed = Boolean(everyone.error);
  const searched = useMemberNames(server, kind, { filter: typed, enabled: failed && typed !== '' });
  return memberListing({
    everyone: { data: everyone.data, failed, loading: everyone.isLoading },
    searched: { data: searched.data, fetching: searched.isFetching },
  });
}
