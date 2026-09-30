import { AppWindow, FolderDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { Kbd } from '../../ui/Kbd';
import styles from './FolderDropOverlay.module.css';

/** How long the overlay takes to fade away: `--duration-normal`, the length of its leaving animations. */
const LEAVE_MS = 200;

/**
 * The drop target shown while a folder is dragged over the window: a calm card over the softly blurred window. It
 * fades out when the drag leaves; the timer always ends it, so it can't stay on screen.
 */
export function FolderDropOverlay({ visible, newWindow }: { visible: boolean; newWindow: boolean }) {
  const [wasVisible, setWasVisible] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setLeaving(!visible);
  }
  // While leaving, the words stay as they were: the drop's Shift must not flip them as they fade.
  const lastNewWindow = useRef(newWindow);
  if (visible) lastNewWindow.current = newWindow;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (!visible && !leaving) return null;
  const inNewWindow = lastNewWindow.current;
  return (
    <div className={`${styles.backdrop} ${visible ? '' : styles.leaving}`}>
      <div className={styles.card}>
        {/* Keyed so the icon lifts in again when Shift changes where the folder opens. */}
        <div key={String(inNewWindow)} className={styles.icon}>
          {inNewWindow ? <AppWindow size={28} strokeWidth={1.75} /> : <FolderDown size={28} strokeWidth={1.75} />}
        </div>
        <span className={styles.title}>{inNewWindow ? 'Open in a new window' : 'Open or create a workspace'}</span>
        <span className={styles.hint}>Drop a folder here</span>
        <span className={styles.shiftHint}>
          {inNewWindow ? 'Release' : 'Hold'} <Kbd keys={hotkey('dropInNewWindow')} /> {inNewWindow ? 'to open it here' : 'to open in a new window'}
        </span>
      </div>
    </div>
  );
}
