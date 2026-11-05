import type { ReactNode } from 'react';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { Stowable } from '../../ui/Stowable';
import { DiffHeader, type DiffHeaderProps } from './DiffHeader';
import styles from './TargetDiff.module.css';

interface DiffFrameProps extends DiffHeaderProps {
  children: ReactNode;
}

/**
 * A diff's header over its body, the same while what it compares loads, when there is nothing, and once it's in. The
 * header goes out of sight while the diff is expanded.
 */
export function DiffFrame({ description, toolbar, children }: DiffFrameProps) {
  const diffExpanded = useDiffExpanded();
  return (
    <div className={styles.diff}>
      <Stowable stowed={diffExpanded}>
        <DiffHeader description={description} toolbar={toolbar} />
      </Stowable>
      {children}
    </div>
  );
}
