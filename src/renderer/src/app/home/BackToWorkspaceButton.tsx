import { ChevronLeft } from 'lucide-react';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { useBackButtons } from '../navigation/useBackButtons';
import { useSession } from '../workspace/sessionStore';
import { returnToWorkspace } from '../workspace/useOpenWorkspace';
import { useWorkspaceList } from '../workspace/workspaceQueries';
import { workspaceToReturnTo } from './workspaceToReturnTo';
import styles from './BackToWorkspaceButton.module.css';

/**
 * The way back to the workspace this window left for the home screen, after the house in the top bar, as a page's
 * breadcrumb goes back ("‹ Changes"): it reopens it on the view it showed. Back (⌘[, Alt+←) and the mouse's back
 * button do the same. Nothing shows in a window that started here, or once the workspace is gone.
 */
export function BackToWorkspaceButton() {
  const { leftWorkspacePath, openWorkspace } = useSession();
  const { data: workspaces } = useWorkspaceList();
  const workspace = workspaceToReturnTo(leftWorkspacePath, workspaces);
  const goBack = (): void => void (workspace && returnToWorkspace(workspace.path, openWorkspace));
  useShortcut(hotkey('back'), goBack, workspace !== null);
  useBackButtons(goBack);

  if (!workspace) return null;
  return (
    <button type="button" className={styles.back} onClick={goBack} data-tip={`Back to ${workspace.name}`} data-tip-shortcut={hotkey('back')}>
      <ChevronLeft size={15} className={styles.chevron} />
      <span className={styles.name}>{workspace.name}</span>
    </button>
  );
}
