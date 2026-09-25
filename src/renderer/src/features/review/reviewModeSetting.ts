import type { AppSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { saveSettings, useSettings } from '../../app/settings/useSettings';
import { toast } from '../../ui/toast/toastStore';
import { withReviewMode } from './reviewModeWorkspaces';

export function useReviewModeOn(workspacePath: string): boolean {
  return useSettings().reviewModeWorkspaces.includes(workspacePath);
}

/** Turns review mode on or off for the workspace. Turning it on is taking the offer, so the hint never shows again. */
export async function setReviewMode(workspacePath: string, on: boolean): Promise<void> {
  const { reviewModeWorkspaces } = queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? (await api.settings.get());
  await saveSettings({ reviewModeWorkspaces: withReviewMode(reviewModeWorkspaces, workspacePath, on), ...(on && { reviewModeHintDone: true }) });
}

/** Review mode came on without its button (R, or marking a file from a menu): say so, how it works, and the way back. */
export function announceReviewMode(workspacePath: string): void {
  toast.info('Review mode on', 'R marks files, J/K move', { label: 'Turn off', run: () => void setReviewMode(workspacePath, false) });
}
