import type { LucideIcon } from 'lucide-react';
import styles from './ItemMark.module.css';

interface ItemMarkProps {
  icon: LucideIcon;
  /** What it means, in its tooltip: the row shows the icon alone. */
  label: string;
  detail?: string;
  /** `alert` for what stands in the user's way (someone else's lock); quiet otherwise. */
  tone?: 'quiet' | 'alert';
}

/** A small icon among an item row's extras, just before its status letter (a lock, an xlink), its words in its tooltip. */
export function ItemMark({ icon: Icon, label, detail, tone = 'quiet' }: ItemMarkProps) {
  return (
    <span className={styles.mark} data-tone={tone} data-tip={label} data-tip-sub={detail} role="img" aria-label={label}>
      <Icon size={13} />
    </span>
  );
}
