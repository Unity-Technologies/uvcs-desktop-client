import { GitPullRequest } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PathLabel } from '../../components/PathLabel';
import { textMeasurer } from '../../lib/measureText';
import { Button } from '../../ui/Button';
import { fitMergeTitle } from '../merge/fitMergeTitle';
import type { MergeTitle } from '../merge/mergeDescription';
import styles from './TaskMergeButton.module.css';

interface TaskMergeButtonProps {
  source: string;
  destination: string;
  tooltip: string;
  /** Under a list: a ghost button at the start instead of a button centered in an empty state. */
  quiet?: boolean;
  onClick: () => void;
}

/**
 * "Merge subtask into child_1", never wider than where it sits: the words stay and the branches give way from their
 * middle (`fitMergeTitle`), fitted to the room less the button's own padding and icon.
 */
export function TaskMergeButton({ source, destination, tooltip, quiet, onClick }: TaskMergeButtonProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const title = useMemo<MergeTitle>(() => ({ verb: 'Merge', source, preposition: 'into', destination }), [source, destination]);
  const [fitted, setFitted] = useState(title);

  useLayoutEffect(() => {
    const [room, button, label] = [roomRef.current, buttonRef.current, labelRef.current];
    if (!room || !button || !label) return;
    const fit = (): void => {
      const chrome = button.offsetWidth - label.offsetWidth;
      // A few pixels to spare for the gaps between the parts, which the measure of their text leaves out.
      setFitted(fitMergeTitle(title, room.clientWidth - chrome - 8, textMeasurer(label)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(room);
    return () => observer.disconnect();
  }, [title]);

  return (
    <div ref={roomRef} className={styles.room} data-quiet={quiet}>
      <Button
        ref={buttonRef}
        className={styles.button}
        variant={quiet ? 'ghost' : 'secondary'}
        size={quiet ? 'small' : 'medium'}
        icon={<GitPullRequest size={13} />}
        onClick={onClick}
        data-tip={tooltip}
      >
        <span ref={labelRef} className={styles.label}>
          {fitted.verb}{' '}
          <PathLabel path={fitted.source} fitContent tooltip={false} />
          {' '}{fitted.preposition}{' '}
          <PathLabel path={fitted.destination} fitContent tooltip={false} />
        </span>
      </Button>
    </div>
  );
}
