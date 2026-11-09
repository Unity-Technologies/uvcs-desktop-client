import type { Action } from '../../../lib/actions';

/**
 * A sign-in's menu where Use is its one button (a repository with no tracker yet; docs/features/issue-trackers.md,
 * "Connecting"): its ⋯ button's name, and Sign out, asked first (`askToSignOut`).
 */
export function signInMenuEntries(row: { account: string; host: string }, signOut: () => void): { label: string; entries: Action[] } {
  return {
    label: `More for ${row.account} at ${row.host}`,
    entries: [{ id: 'signOut', label: 'Sign out…', danger: true, run: signOut }],
  };
}
