import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { RelativeTime } from './RelativeTime';
import { displayName } from '../lib/userName';
import styles from './DetailsPanel.module.css';

interface DetailsPanelProps {
  icon: ReactNode;
  /** What the object is, e.g. "Branch" or "Changeset". */
  kind: string;
  /** The object's short name, e.g. the last segment of a branch path. */
  title: ReactNode;
  /** Where it lives, e.g. the parent branch; shown next to the kind. */
  context?: ReactNode;
  /** Who created it and when. */
  author?: { user: string; date: string };
  /** Small status pills such as "Current" or "Hidden". */
  badges?: ReactNode;
  /** The main things to do with the object; the first one should be the primary button. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** The side panel describing the object selected in a list or graph. */
export function DetailsPanel({ icon, kind, title, context, author, badges, actions, children }: DetailsPanelProps) {
  return (
    <aside className={styles.panel}>
      <header className={styles.hero}>
        <div className={styles.kindRow}>
          <span className={styles.icon}>{icon}</span>
          <span className={styles.kind}>{kind}</span>
          {context && (
            <>
              <span className={styles.separator}>·</span>
              <span className={styles.context} data-tip-overflow data-tip={typeof context === 'string' ? context : undefined}>
                {context}
              </span>
            </>
          )}
        </div>
        <h2 className={`${styles.title} selectable`}>{title}</h2>
        {(author || badges) && (
          <div className={styles.metaRow}>
            {author && (
              <span className={styles.author}>
                <Avatar user={author.user} size={18} />
                <span className={styles.authorName}>{displayName(author.user)}</span>
                <span className={styles.dot}>·</span>
                <RelativeTime date={author.date} />
              </span>
            )}
            {badges}
          </div>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}

type BadgeTone = 'accent' | 'success' | 'neutral' | 'warning';

export function DetailsBadge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}

interface DetailsSectionProps {
  title: string;
  /** A small control at the right of the title, e.g. "Add". */
  action?: ReactNode;
  children: ReactNode;
}

/** A titled card inside the details panel. */
export function DetailsSection({ title, action, children }: DetailsSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {action}
      </div>
      <div className={styles.card}>{children}</div>
    </section>
  );
}

/** A comment or free text, keeping its line breaks. */
export function DetailsText({ text, placeholder }: { text: string; placeholder: string }) {
  return text ? <p className={`${styles.text} selectable`}>{text}</p> : <p className={styles.placeholder}>{placeholder}</p>;
}

/** A friendly message inside a section, e.g. "No attributes yet". */
export function DetailsEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.placeholder}>{children}</p>;
}
