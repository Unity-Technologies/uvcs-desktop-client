import { AppWindow, FolderDown, FolderPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { Kbd } from '../../ui/Kbd';
import type { DropOverlayWording } from './dropOverlayWording';
import styles from './FolderDropOverlay.module.css';

/** How long the overlay takes to fade away: `--duration-normal`, the length of its leaving animations. */
const LEAVE_MS = 200;

/**
 * The drop target shown while a folder is dragged over the window: a calm card over the softly blurred window. It
 * fades out when the drag leaves; the timer always ends it, so it can't stay on screen.
 */
const ICONS = { folder: FolderDown, newWindow: AppWindow, create: FolderPlus };

export function FolderDropOverlay({ visible, wording }: { visible: boolean; wording: DropOverlayWording }) {
  const [wasVisible, setWasVisible] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setLeaving(!visible);
  }
  // While leaving, the words stay as they were: the drop's Shift must not flip them as they fade.
  const lastWording = useRef(wording);
  if (visible) lastWording.current = wording;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (!visible && !leaving) return null;
  const { icon, title, line, shift } = lastWording.current;
  const Icon = ICONS[icon];
  return (
    <div className={`${styles.backdrop} ${visible ? '' : styles.leaving}`}>
      <div className={styles.card}>
        {/* Keyed so the icon lifts in again when what the drop does changes. */}
        <div key={icon} className={styles.icon}>
          <Icon size={28} strokeWidth={1.75} />
        </div>
        <span className={styles.title}>{title}</span>
        <span className={styles.line}>
          {line}
          {shift && (
            <>
              {' '}
              {shift.verb} <Kbd keys={hotkey('dropInNewWindow')} /> {shift.purpose}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
