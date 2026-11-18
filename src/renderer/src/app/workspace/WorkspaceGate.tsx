import { WorkspaceScreen } from '../shell/WorkspaceScreen';
import { SignInScreen } from '../signIn/SignInScreen';
import { signInProblemOf } from '../signIn/windowSignIn';
import { BrokenWorkspace } from './BrokenWorkspace';
import { MissingWorkspace } from './missing/MissingWorkspace';
import { useWorkspaceFolderMissing, useWorkspaceInfo, useWorkspacePath } from './useWorkspace';

/** Opens the workspace screen, or explains why the workspace can't be opened (missing folder, unreadable workspace). */
export function WorkspaceGate() {
  const path = useWorkspacePath();
  const folderMissing = useWorkspaceFolderMissing();

  // A file-system check: it answers in a moment, so there's nothing to show meanwhile.
  if (folderMissing.isPending) return null;
  if (folderMissing.data) {
    return <MissingWorkspace path={path} checking={folderMissing.isFetching} onLookAgain={() => void folderMissing.refetch()} />;
  }
  return <ReadableWorkspace path={path} />;
}

function ReadableWorkspace({ path }: { path: string }) {
  const info = useWorkspaceInfo();
  // Its header asks the server for the branch's head, so a workspace opened while its server needs a sign-in can't be
  // read: the sign-in screen says so, and the workspace opens once signed in (docs/features/accounts.md).
  const signIn = info.data ? null : signInProblemOf(info.error);
  if (signIn) return <SignInScreen problem={signIn} underTopBar={false} />;
  // Keep the screen when a later refresh fails; the views report their own errors.
  if (info.error && !info.data) {
    return <BrokenWorkspace path={path} error={info.error} retrying={info.isFetching} onRetry={() => void info.refetch()} />;
  }
  return <WorkspaceScreen />;
}
