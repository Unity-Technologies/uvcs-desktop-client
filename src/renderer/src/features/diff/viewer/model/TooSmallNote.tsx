// What the pane of a version too small to see says (`tooSmallToSee`): why it looks empty, and a way to frame it. The
// shared framing that makes it so stays: it is what lets sizes compare.

import { Focus } from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { tooSmallWords, type TooSmall } from './tooSmallToSee';
import styles from './TooSmallNote.module.css';

interface TooSmallNoteProps {
  tooSmall: TooSmall;
  /** The side's pane across the stage, as fractions of its width. */
  area: { left: number; width: number };
  onFrame: () => void;
}

export function TooSmallNote({ tooSmall, area, onFrame }: TooSmallNoteProps) {
  return (
    <div className={styles.area} style={{ left: `${area.left * 100}%`, width: `${area.width * 100}%` }}>
      <p className={styles.note} role="status" data-no-pan>
        {tooSmallWords(tooSmall.times)}
        <Button size="small" variant="ghost" icon={<Focus size={13} />} onClick={onFrame}>
          Frame it
        </Button>
      </p>
    </div>
  );
}
