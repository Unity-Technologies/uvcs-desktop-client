import { SegmentedControl } from '../../../ui/SegmentedControl';
import { useDiffPreferences } from './diffPreferencesStore';
import { MODEL_DIFF_MODES, type ModelDiffMode } from './model/modelDiffModes';

/** How two models are compared (side by side, onion skin, swipe), remembered for every model diff. */
export function ModelModeSwitch() {
  const { modelMode, setModelMode } = useDiffPreferences();
  return (
    <SegmentedControl<ModelDiffMode>
      value={modelMode}
      onChange={setModelMode}
      segments={MODEL_DIFF_MODES.map((mode) => ({ value: mode.value, label: <>{mode.icon} <span data-toolbar-label>{mode.label}</span></>, title: mode.title ?? mode.label }))}
    />
  );
}
