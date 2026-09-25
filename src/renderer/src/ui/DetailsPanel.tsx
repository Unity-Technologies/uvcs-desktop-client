import type { ReactNode } from 'react';
import styles from './DetailsPanel.module.css';

interface DetailsPanelProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Primary actions for the object, shown under the title. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** The side panel describing the object selected in a list. */
export function DetailsPanel({ icon, title, subtitle, actions, children }: DetailsPanelProps) {
  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <div className={styles.titles}>
          <h2 className={`${styles.title} selectable`}>{title}</h2>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </header>
      {actions && <div className={styles.actions}>{actions}</div>}
      {children}
    </aside>
  );
}

export function DetailsSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label/value pairs, e.g. "Created by", "Changeset". Empty values are skipped. */
export function PropertyList({ properties }: { properties: [label: string, value: ReactNode][] }) {
  return (
    <dl className={styles.properties}>
      {properties
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([label, value]) => (
          <div key={label} className={styles.property}>
            <dt>{label}</dt>
            <dd className="selectable">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

/** A comment or free text, keeping its line breaks. */
export function DetailsText({ text, placeholder }: { text: string; placeholder: string }) {
  return text ? <p className={`${styles.text} selectable`}>{text}</p> : <p className={styles.placeholder}>{placeholder}</p>;
}
