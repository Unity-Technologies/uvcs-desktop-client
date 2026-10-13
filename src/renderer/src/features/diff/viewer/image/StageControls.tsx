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
  /**
   * Why the button can't be used now, said in its tooltip under its label. It stays focusable and hoverable (not
   * `disabled`, which hides its tooltip from the pointer), and its click does nothing.
   */
  unavailable?: string | null;
  onClick: () => void;
}

export function StageButton({ icon, label, shortcut, active = false, unavailable = null, onClick }: StageButtonProps) {
  return (
    <IconButton
      className={styles.button}
      data-active={active || undefined}
      aria-disabled={unavailable !== null || undefined}
      icon={icon}
      label={unavailable === null ? label : `${label}\n${unavailable}`}
      shortcut={shortcut}
      onClick={unavailable === null ? onClick : undefined}
    />
  );
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
