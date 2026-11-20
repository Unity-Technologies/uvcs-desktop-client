import { Columns2, Rows2 } from 'lucide-react';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { useDiffPreferences, type DiffLayout } from './diffPreferencesStore';

/**
 * Split or unified: one preference for every text diff (`useDiffPreferences`), switched from the diff's toolbar and
 * from a comparison dialog's header alike. Its words are `data-toolbar-label`, which a narrow toolbar hides.
 */
export function DiffLayoutSwitch() {
  const { layout, setLayout } = useDiffPreferences();
  return (
    <SegmentedControl<DiffLayout>
      value={layout}
      onChange={setLayout}
      segments={[
        { value: 'split', label: <><Columns2 size={13} /> <span data-toolbar-label>Split</span></>, title: 'Side-by-side view' },
        { value: 'unified', label: <><Rows2 size={13} /> <span data-toolbar-label>Unified</span></>, title: 'Unified view' },
      ]}
    />
  );
}
