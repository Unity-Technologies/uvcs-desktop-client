import type { UpdateStatus } from '@shared/domain/appUpdate';
import type { ToastKind } from '../../ui/toast/toastStore';

export interface CheckFeedback {
  kind: ToastKind;
  title: string;
  detail?: string;
}

/**
 * The toast a window shows while the check it asked for runs and when it answers ("Check for Updates…" in the menu or
 * the palette): the checks the app makes on its own say nothing, and the About dialog shows the same itself. Null once
 * an update is found: the update card takes over.
 */
export function checkFeedback(status: UpdateStatus): CheckFeedback | null {
  switch (status.state) {
    case 'checking':
      return { kind: 'progress', title: 'Checking for updates…' };
    case 'upToDate':
      return { kind: 'success', title: "You're on the latest version." };
    case 'failed':
      return { kind: 'error', title: "Couldn't check for updates", detail: status.error };
    case 'unavailable':
      return { kind: 'info', title: 'Development builds don’t update.' };
    case 'idle':
    case 'downloading':
    case 'ready':
      return null;
  }
}
