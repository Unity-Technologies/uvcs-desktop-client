import { Code, ImageIcon } from 'lucide-react';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import type { Representation } from './diffPresentation';

interface RepresentationSwitchProps {
  value: Representation;
  onChange: (value: Representation) => void;
}

/** "Code | Image", for a file that is text and an image at once (SVG). */
export function RepresentationSwitch({ value, onChange }: RepresentationSwitchProps) {
  return (
    <SegmentedControl<Representation>
      value={value}
      onChange={onChange}
      segments={[
        { value: 'text', label: <><Code size={13} /> <span data-toolbar-label>Code</span></>, title: 'Compare the text' },
        { value: 'image', label: <><ImageIcon size={13} /> <span data-toolbar-label>Image</span></>, title: 'Compare the rendered images' },
      ]}
    />
  );
}
