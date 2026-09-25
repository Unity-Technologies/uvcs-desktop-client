import { Link2, Lock } from 'lucide-react';
import type { XlinkTarget } from '@shared/domain/explorer';
import styles from './FileTreeTable.module.css';

/** "→ nervathirdparty@17568" after an xlinked folder's name; the icon tells a writable xlink from a read-only one. */
export function XlinkChip({ xlink }: { xlink: XlinkTarget }) {
  const where = xlink.path === '/' ? '' : ` (${xlink.path})`;
  return (
    <span
      className={styles.xlink}
      data-tip={`${xlink.writable ? 'Writable' : 'Read-only'} xlink to ${xlink.repository}@${xlink.server}${where}`}
      data-tip-sub={`Changeset ${xlink.changeset}${xlink.writable ? ' · changes under it are checked in to that repository' : ''}`}
    >
      {xlink.writable ? <Link2 size={11} /> : <Lock size={10} />}
      <span className={styles.xlinkTarget}>
        → {xlink.repository}@{xlink.changeset}
      </span>
    </span>
  );
}
