import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { permissionSpec, type MemberKind, type PermissionTarget } from '@shared/domain/permissions';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';

/**
 * The object's permissions, read as the dialog opens. Never re-read on focus: what the dialog's edits are made on
 * stays put until they're saved.
 */
export function usePermissions(target: PermissionTarget) {
  return useQuery({
    queryKey: queryKeys.permissions(target.server, permissionSpec(target)),
    queryFn: () => api.permissions.read(target),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/**
 * The server's users or groups (`cm listusers`): who can be added, and which entries are groups. One list per kind
 * for the session, filtered on the server (`filter`) where the whole list can't be read, and for a comment's mention
 * (`searchPeople`), which reads the picker's whole list when it is cached. `keepWhileSearching` keeps the last
 * answer while the next filter is read.
 */
export function useMemberNames(server: string, kind: MemberKind, { filter = '', enabled = true, keepWhileSearching = false } = {}) {
  return useQuery({
    queryKey: queryKeys.permissionMembers(server, kind, filter),
    queryFn: () => api.permissions.members(server, kind, filter || undefined),
    enabled,
    placeholderData: keepWhileSearching ? keepPreviousData : undefined,
    ...SLOW_CHANGING_QUERY,
  });
}
