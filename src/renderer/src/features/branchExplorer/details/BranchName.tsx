import type { CSSProperties } from 'react';
import { shortBranchName } from '@shared/domain/specs';
import { branchHue } from '../model/branchHue';
import styles from './DetailsPanel.module.css';

interface BranchNameProps {
  /** The full name, which also picks the color. */
  name: string;
  /** Shows only the last segment of the name. */
  short?: boolean;
  onClick?: () => void;
}

/** A branch name with its graph color; clickable when `onClick` is given. */
export function BranchName({ name, short = false, onClick }: BranchNameProps) {
  const shown = short ? shortBranchName(name) : name;
  const hue = branchHue(name);
  const dot = (
    <span className={styles.branchDot} data-hue={hue ?? undefined} style={{ '--branch-hue': hue ?? undefined } as CSSProperties} />
  );
  if (!onClick) {
    return (
      <span>
        {dot}
        {shown}
      </span>
    );
  }
  return (
    <button className={styles.link} onClick={onClick}>
      {dot}
      {shown}
    </button>
  );
}
