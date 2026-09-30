import type { ReactNode } from 'react';
import styles from './SettingsDialog.module.css';

/** A titled group of settings in a pane. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  );
}
