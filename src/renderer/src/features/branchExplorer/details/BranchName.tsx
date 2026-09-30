import type { CSSProperties } from 'react';
import { DetailsLink } from '../../../ui/DetailsLink';
import { branchHue } from '../model/branchHue';
import styles from './BranchName.module.css';

/** A branch name with its graph color, selecting the branch when clicked. */
export function BranchName({ name, onClick }: { name: string; onClick: () => void }) {
  const hue = branchHue(name);
  return (
    <DetailsLink onClick={onClick}>
      <span className={styles.branchDot} data-hue={hue ?? undefined} style={{ '--branch-hue': hue ?? undefined } as CSSProperties} />
      {name}
    </DetailsLink>
  );
}
