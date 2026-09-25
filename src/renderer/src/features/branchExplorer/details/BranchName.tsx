import type { CSSProperties } from 'react';
import { branchHue } from '../model/branchHue';
import styles from './DetailsPanel.module.css';

/** A branch name with its graph color; clickable when `onClick` is given. */
export function BranchName({ name, onClick }: { name: string; onClick?: () => void }) {
  const hue = branchHue(name);
  const dot = (
    <span className={styles.branchDot} data-hue={hue ?? undefined} style={{ '--branch-hue': hue ?? undefined } as CSSProperties} />
  );
  if (!onClick) {
    return (
      <span>
        {dot}
        {name}
      </span>
    );
  }
  return (
    <button className={styles.link} onClick={onClick}>
      {dot}
      {name}
    </button>
  );
}
