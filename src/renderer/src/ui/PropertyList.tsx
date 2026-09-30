import { Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../lib/classNames';
import { copyToClipboard } from './copyToClipboard';
import styles from './PropertyList.module.css';

export interface Property {
  label: string;
  value: ReactNode;
  /** Monospaced values such as hashes, specs and paths. */
  mono?: boolean;
  /** Text to copy with the row's copy button, for values people paste elsewhere. */
  copyText?: string;
}

/** Label / value rows for details panels. Empty values are skipped. */
export function PropertyList({ properties }: { properties: Property[] }) {
  const visible = properties.filter((property) => property.value !== '' && property.value !== null && property.value !== undefined);

  return (
    <dl className={styles.list}>
      {visible.map((property) => (
        <div key={property.label} className={styles.row}>
          <dt className={styles.label}>{property.label}</dt>
          <dd className={classNames(styles.value, property.mono && 'mono', 'selectable')}>{property.value}</dd>
          {property.copyText && (
            <button
              className={styles.copy}
              onClick={() => copyToClipboard(property.copyText!, property.label)}
              aria-label={`Copy ${property.label.toLowerCase()}`}
            >
              <Copy size={12} />
            </button>
          )}
        </div>
      ))}
    </dl>
  );
}
