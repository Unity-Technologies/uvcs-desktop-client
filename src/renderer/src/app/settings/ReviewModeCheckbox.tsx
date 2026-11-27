import { workspacePlace } from '@shared/domain/place';
import { reviewModeLabel } from '../../features/review/reviewModeLabel';
import { setReviewMode, useReviewModeOn } from '../../features/review/reviewModeSetting';
import { useKeymap } from '../../lib/keymapStore';
import { isMac } from '../../lib/platform';
import { hotkey } from '../../lib/shortcutRegistry';
import { Checkbox } from '../../ui/Checkbox';

/** Review mode for the workspace a window shows, in Settings' Changes pane. */
export function ReviewModeCheckbox({ workspacePath }: { workspacePath: string }) {
  const place = workspacePlace(workspacePath);
  // Renders again as a person changes the key in Settings › Keyboard, the dialog this sits in.
  useKeymap();
  return <Checkbox label={reviewModeLabel(hotkey('review'), isMac)} checked={useReviewModeOn(place)} onChange={(on) => void setReviewMode(place, on)} />;
}
