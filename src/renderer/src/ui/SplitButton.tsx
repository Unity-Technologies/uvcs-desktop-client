import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MenuEntry } from '../lib/actions';
import { Button, type ButtonSize, type ButtonVariant } from './Button';
import { ActionDropdownMenu } from './menu/ActionDropdownMenu';
import styles from './SplitButton.module.css';

interface SplitButtonProps {
  children: ReactNode;
  onClick: () => void;
  /** The other choices, behind the caret. */
  menu: MenuEntry[];
  menuLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  tip?: string;
  /** A dimmed second line under the tip. */
  tipSub?: string;
  /** The shortcut that clicks it, shown in its tip. */
  shortcut?: string;
}

/** A button doing the usual thing, with the alternatives behind a caret joined to it. */
export function SplitButton({ children, onClick, menu, menuLabel, variant = 'secondary', size = 'small', icon, loading, disabled, tip, tipSub, shortcut }: SplitButtonProps) {
  return (
    <div className={styles.split}>
      <Button variant={variant} size={size} className={styles.main} icon={icon} loading={loading} disabled={disabled} data-tip={tip} data-tip-sub={tipSub} data-tip-shortcut={shortcut} onClick={onClick}>
        {children}
      </Button>
      <ActionDropdownMenu entries={menu}>
        <Button variant={variant} size={size} className={styles.caret} icon={<ChevronDown size={14} />} disabled={loading || disabled} aria-label={menuLabel} data-tip={menuLabel} />
      </ActionDropdownMenu>
    </div>
  );
}
