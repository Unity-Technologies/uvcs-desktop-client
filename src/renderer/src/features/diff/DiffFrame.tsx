import type { ReactNode } from 'react';
import { DiffHeader, type DiffHeaderProps } from './DiffHeader';
import styles from './TargetDiff.module.css';

interface DiffFrameProps extends DiffHeaderProps {
  children: ReactNode;
}

/** A diff's header over its body, the same while what it compares loads, when there is nothing, and once it's in. */
export function DiffFrame({ description, toolbar, children }: DiffFrameProps) {
  return (
    <div className={styles.diff}>
      <DiffHeader description={description} toolbar={toolbar} />
      {children}
    </div>
  );
}
