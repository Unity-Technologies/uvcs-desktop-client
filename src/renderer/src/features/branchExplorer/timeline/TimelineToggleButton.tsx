import { TimelineIcon } from '../../../components/TimelineIcon';
import { hotkey } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { useBranchExplorerPreferences } from '../branchExplorerStore';
import { timelineToggle } from './timelineToggle';

/** Shows or hides the Timeline: in the Branch Explorer's header, beside the details' toggle, pressed while it shows. */
export function TimelineToggleButton() {
  const shown = useBranchExplorerPreferences((state) => state.showTimeline);
  const set = useBranchExplorerPreferences((state) => state.set);
  const toggle = timelineToggle(shown, true);
  return (
    <IconButton
      icon={<TimelineIcon size={14} />}
      label={toggle.label}
      shortcut={hotkey('graphTimeline')}
      aria-pressed={shown}
      onClick={() => set({ showTimeline: toggle.show })}
    />
  );
}
