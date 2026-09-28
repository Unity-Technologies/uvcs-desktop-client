import { FileDiff, ScanText } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { SegmentedControl } from '../../ui/SegmentedControl';
import type { FileView } from './fileView';
import styles from './FileViewSwitch.module.css';

interface FileViewSwitchProps {
  value: FileView;
  onChange: (view: FileView) => void;
  /** The segments' tips: what the diff compares, what is annotated. */
  tips: Record<FileView, string>;
  /** The key that switches between the two where one does, shown in both tips. */
  shortcut?: string;
}

/**
 * Whether the switch had the focus when it went away. Each view draws its own in its toolbar, so switching replaces
 * it: the new one takes the focus back, and ← → keep switching.
 */
let focusedWhenGone = false;

/** "Diff | Annotate", first in the toolbar of a file's diff or annotation (History's, the Files view's). */
export function FileViewSwitch({ value, onChange, tips, shortcut }: FileViewSwitchProps) {
  const switchRef = useRef<HTMLSpanElement>(null);

  // Layout effects: the old switch is still in the document when its cleanup runs, and the new one focuses before paint.
  useLayoutEffect(() => {
    const element = switchRef.current;
    if (focusedWhenGone) element?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    focusedWhenGone = false;
    return () => {
      focusedWhenGone = element?.contains(document.activeElement) ?? false;
    };
  }, []);

  return (
    <span ref={switchRef} className={styles.switch}>
      <SegmentedControl<FileView>
        value={value}
        onChange={onChange}
        label="Show the file as"
        segments={[
          { value: 'diff', label: <><FileDiff size={13} /> Diff</>, title: tips.diff, shortcut },
          { value: 'annotate', label: <><ScanText size={13} /> Annotate</>, title: tips.annotate, shortcut },
        ]}
      />
    </span>
  );
}
