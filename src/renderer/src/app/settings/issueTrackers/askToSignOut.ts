import { api } from '../../../api/client';
import { confirm } from '../../../ui/dialog/confirm';
import type { SignInRow } from './connectFlow';

/** Signs out of a sign-in once the user says so (`signOutQuestion`: the repositories that use it lose their tracker). */
export function askToSignOut(row: SignInRow): void {
  void confirm({ ...row.signOutQuestion, danger: true }).then((sure) => {
    if (sure) void api.issueTrackers.signOut(row.id);
  });
}
