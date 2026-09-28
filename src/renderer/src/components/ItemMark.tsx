import type { LucideIcon } from 'lucide-react';
import styles from './ItemMark.module.css';

interface ItemMarkProps {
  icon: LucideIcon;
  /** What it means, in its tooltip: the row shows the icon alone. */
  label: string;
  detail?: string;
  /** `alert` for what stands in the user's way (someone else's lock); quiet otherwise. */
  tone?: 'quiet' | 'alert';
  /**
   * Makes the mark a button leading to more about it (a lock to the Locks view), `label` saying so. The row's own
   * click, double click and selection stay out of it; the keyboard gets the same through the row's menu.
   */
  onClick?: () => void;
}

/** A small icon among an item row's extras, just before its status letter (a lock, an xlink), its words in its tooltip. */
export function ItemMark({ icon: Icon, label, detail, tone = 'quiet', onClick }: ItemMarkProps) {
  if (!onClick) {
    return (
      <span className={styles.mark} data-tone={tone} data-tip={label} data-tip-sub={detail} role="img" aria-label={label}>
        <Icon size={13} />
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.mark}
      data-tone={tone}
      data-tip={label}
      data-tip-sub={detail}
      aria-label={label}
      tabIndex={-1}
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon size={13} />
    </button>
  );
}
