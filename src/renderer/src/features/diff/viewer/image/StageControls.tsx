// The column of buttons floating at the bottom right of a diff's stage (the UVCS spot): the image diff's zoom, the
// model diff's framing and draw modes. One look for both.

import type { ReactNode } from 'react';
import { IconButton } from '../../../../ui/IconButton';
import styles from './StageControls.module.css';

export function StageControls({ children }: { children: ReactNode }) {
  return <div className={styles.controls}>{children}</div>;
}

interface StageButtonProps {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
}

export function StageButton({ icon, label, shortcut, active = false, onClick }: StageButtonProps) {
  return <IconButton className={styles.button} data-active={active || undefined} icon={icon} label={label} shortcut={shortcut} onClick={onClick} />;
}

export function StageSeparator() {
  return <div className={styles.separator} />;
}

/** A small text button in the column (the zoom percentage). */
export function StageTextButton({ children, tip, onClick }: { children: ReactNode; tip: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.percent} data-tip={tip} onClick={onClick}>
      {children}
    </button>
  );
}
