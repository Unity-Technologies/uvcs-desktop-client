import { SegmentedControl } from '../../../ui/SegmentedControl';
import { useDiffPreferences } from './diffPreferencesStore';
import { IMAGE_DIFF_MODES, type ImageDiffMode } from './image/imageDiffModes';

/** How two images are compared (onion skin, side by side, differences, swipe), remembered for every image diff. */
export function ImageModeSwitch() {
  const { imageMode, setImageMode } = useDiffPreferences();
  return (
    <SegmentedControl<ImageDiffMode>
      value={imageMode}
      onChange={setImageMode}
      segments={IMAGE_DIFF_MODES.map((mode) => ({ value: mode.value, label: <>{mode.icon} <span data-toolbar-label>{mode.label}</span></>, title: mode.title ?? mode.label }))}
    />
  );
}
