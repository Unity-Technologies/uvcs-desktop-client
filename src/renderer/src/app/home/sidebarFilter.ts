import type { ServerProfile } from '@shared/domain/repository';
import { canBeFavorite, showsOrganizationFilter, type ServerGroup } from './serverGroups';

/** What was typed in the sidebar's organization filter, and for which account (its `UserAccount.id`). */
export interface TypedFilter {
  account: string;
  text: string;
}

interface SidebarFilterInput {
  /** The servers the sidebar lists for the shown account. */
  servers: readonly ServerProfile[];
  /** The servers are still being read. */
  reading: boolean;
  /** Folded: the rail shows no filter. */
  rail: boolean;
  /** The shown account's id, empty with none. */
  account: string;
  typed: TypedFilter;
}

/**
 * Whether the sidebar shows its organization filter, and the text it filters by: shown only to someone with many
 * organizations (`showsOrganizationFilter`), once they're read and while the sidebar is open; folded, nothing is
 * filtered. Text typed for another account doesn't apply.
 */
export function sidebarFilter({ servers, reading, rail, account, typed }: SidebarFilterInput): { shows: boolean; text: string } {
  const shows = !reading && !rail && showsOrganizationFilter(servers);
  return { shows, text: shows && typed.account === account ? typed.text : '' };
}

/** The typed filter once the shown account is `account`: emptied when the account changed, so going back finds it empty too. */
export function typedFilterFor(typed: TypedFilter, account: string): TypedFilter {
  return typed.account === account ? typed : { account, text: '' };
}

/** Whether the filter left no organization: the sidebar says so under it. */
export function noOrganizationMatches(groups: readonly ServerGroup[]): boolean {
  return !groups.some((group) => group.servers.some((profile) => canBeFavorite(profile.server)));
}
