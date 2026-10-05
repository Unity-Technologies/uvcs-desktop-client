import { Box, Code, ImageIcon } from 'lucide-react';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import type { Representation } from './diffPresentation';

interface RepresentationSwitchProps {
  value: Representation;
  /** What the file renders as besides its text. */
  rendered: Exclude<Representation, 'text'>;
  onChange: (value: Representation) => void;
}

/** "Code | Image" for a file that is text and an image at once (SVG), "Code | Model" for one that is a model (OBJ). */
export function RepresentationSwitch({ value, rendered, onChange }: RepresentationSwitchProps) {
  const renderedSegment =
    rendered === 'model'
      ? { value: 'model' as const, label: <><Box size={13} /> <span data-toolbar-label>Model</span></>, title: 'Compare the 3D models' }
      : { value: 'image' as const, label: <><ImageIcon size={13} /> <span data-toolbar-label>Image</span></>, title: 'Compare the rendered images' };
  return (
    <SegmentedControl<Representation>
      value={value}
      onChange={onChange}
      segments={[{ value: 'text', label: <><Code size={13} /> <span data-toolbar-label>Code</span></>, title: 'Compare the text' }, renderedSegment]}
    />
  );
}
