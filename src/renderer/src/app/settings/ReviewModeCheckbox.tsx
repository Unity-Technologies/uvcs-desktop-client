import { workspacePlace } from '@shared/domain/place';
import { setReviewMode, useReviewModeOn } from '../../features/review/reviewModeSetting';
import { Checkbox } from '../../ui/Checkbox';

/** Review mode for the workspace a window shows, in Settings' Changes pane. */
export function ReviewModeCheckbox({ workspacePath }: { workspacePath: string }) {
  const place = workspacePlace(workspacePath);
  return (
    <Checkbox
      label="Review mode in this workspace: mark files as you review them, in Changes and every diff (R)"
      checked={useReviewModeOn(place)}
      onChange={(on) => void setReviewMode(place, on)}
    />
  );
}
