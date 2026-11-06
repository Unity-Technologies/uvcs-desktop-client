/** What the picker knows of one list (`cm listusers --onlyusers` or `--onlygroups`): the whole of it, or a search. */
export interface MemberListReads {
  everyone: { data?: readonly string[]; failed: boolean; loading: boolean };
  /** The names matching what was typed, read only where the whole list can't be (a directory with a size limit). */
  searched: { data?: readonly string[]; fetching: boolean };
}

export interface MemberListing {
  names: readonly string[];
  listFailed: boolean;
  loading: boolean;
}

const NO_NAMES: readonly string[] = [];

/** The names a list offers: the whole list, or, where it can't be read, those matching what was typed. */
export function memberListing({ everyone, searched }: MemberListReads): MemberListing {
  return {
    names: everyone.data ?? searched.data ?? NO_NAMES,
    listFailed: everyone.failed,
    loading: (everyone.loading && !everyone.failed) || searched.fetching,
  };
}

/**
 * The note under the picker's rows when a list can't be read whole: every name is then found by what's typed. When
 * only the groups can't be listed, the users all are, and the note says so.
 */
export function pickerFooter(users: MemberListing, groups: MemberListing): string | undefined {
  if (users.listFailed) return 'The server can’t list everyone: type a name to look it up.';
  if (groups.listFailed) return 'The server can’t list its groups: type a group’s name to look it up.';
  return undefined;
}
