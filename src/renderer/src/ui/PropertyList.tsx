import type { ReactNode } from 'react';
import styles from './PropertyList.module.css';

export interface Property {
  label: string;
  value: ReactNode;
  /** Monospaced, selectable values such as hashes and paths. */
  mono?: boolean;
}

/** A label / value list for details panes. Empty values are skipped. */
export function PropertyList({ properties }: { properties: Property[] }) {
  const visible = properties.filter((property) => property.value !== '' && property.value !== null && property.value !== undefined);

  return (
    <dl className={styles.list}>
      {visible.map((property) => (
        <div key={property.label} className={styles.row}>
          <dt className={styles.label}>{property.label}</dt>
          <dd className={[styles.value, property.mono && 'mono', 'selectable'].filter(Boolean).join(' ')}>{property.value}</dd>
        </div>
      ))}
    </dl>
  );
}
