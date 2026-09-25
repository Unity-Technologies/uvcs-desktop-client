import { Columns2, Diff, Layers, SeparatorVertical } from 'lucide-react';
import type { ReactNode } from 'react';

export type ImageDiffMode = 'onion' | 'sideBySide' | 'differences' | 'swipe';

interface ImageModeDefinition {
  value: ImageDiffMode;
  label: string;
  /** Tooltip, when the label is an abbreviation. */
  title?: string;
  icon: ReactNode;
}

/**
 * The header's mode options, in the order they read naturally. Labels are deliberately one short
 * word each: four segments share the header with the file path; tooltips carry the full names.
 * (Blink lives inside Onion as its play button: it's the blend automated, not a fifth way to look.)
 */
export const IMAGE_DIFF_MODES: ImageModeDefinition[] = [
  { value: 'onion', label: 'Onion', title: 'Onion skin', icon: <Layers size={13} /> },
  { value: 'sideBySide', label: 'Split', title: 'Side by side', icon: <Columns2 size={13} /> },
  { value: 'differences', label: 'Diffs', title: 'Differences', icon: <Diff size={13} /> },
  { value: 'swipe', label: 'Swipe', icon: <SeparatorVertical size={13} /> },
];
