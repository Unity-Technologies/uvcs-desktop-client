import { api } from '../../../api/client';
import { confirm } from '../../../ui/dialog/confirm';
import type { SignInRow } from './connectFlow';

/** Signs out of a sign-in once the user says so (`signOutQuestion`: the repositories that use it lose their tracker). */
export async function askToSignOut(row: SignInRow): Promise<void> {
  if (await confirm({ ...row.signOutQuestion, danger: true })) await api.issueTrackers.signOut(row.id);
}
