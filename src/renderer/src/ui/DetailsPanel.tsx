import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { withoutAction, type MenuEntry } from '../lib/actions';
import { displayName } from '../lib/userName';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { ActionDropdownMenu } from './menu/ActionDropdownMenu';
import { RelativeTime } from './RelativeTime';
import styles from './DetailsPanel.module.css';

interface DetailsPanelProps {
  icon: ReactNode;
  /** What the object is, e.g. "Branch" or "Changeset 12". */
  kind: string;
  /** The object's short name, e.g. the last segment of a branch path. */
  title: ReactNode;
  /** Where it lives, e.g. the parent branch; shown next to the kind. */
  context?: ReactNode;
  /** Who created it and when. */
  author?: { user: string; date: string };
  /** Small status pills such as "Current" or "Hidden". */
  badges?: ReactNode;
  /** The one main thing to do with the object, the same as double-clicking or pressing Enter on it: usually "Open diff". */
  primaryAction?: ReactNode;
  /** The object's context menu, behind a "More actions" button next to the primary action. */
  menu?: MenuEntry[];
  /** The menu entry the primary action repeats, left out of the menu. */
  primaryActionId?: string;
  /** The body fills the panel without padding or scrolling, e.g. for a diff. */
  fill?: boolean;
  children?: ReactNode;
}

/** The side panel describing the object selected in a list or graph. */
export function DetailsPanel({ icon, kind, title, context, author, badges, primaryAction, menu = [], primaryActionId, fill = false, children }: DetailsPanelProps) {
  const moreActions = primaryActionId ? withoutAction(menu, primaryActionId) : menu;

  return (
    <aside className={styles.panel} data-fill={fill}>
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
        <h2 className={`${styles.title} selectable`} data-tip-overflow data-tip={typeof title === 'string' ? title : undefined}>
          {title}
        </h2>
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
        {(primaryAction || moreActions.length > 0) && (
          <div className={styles.actions}>
            <div className={styles.primaryAction}>{primaryAction}</div>
            {moreActions.length > 0 && (
              <ActionDropdownMenu entries={moreActions}>
                <IconButton variant="secondary" icon={<MoreHorizontal size={15} />} label="More actions" />
              </ActionDropdownMenu>
            )}
          </div>
        )}
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

/** Placeholder rows while a section loads. */
export function DetailsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={styles.skeletonRow} />
      ))}
    </div>
  );
}

/** The whole panel while the list it describes loads: the hero's shape, then two sections. */
export function DetailsPanelSkeleton() {
  return (
    <aside className={styles.panel} aria-busy="true" aria-label="Loading">
      <header className={styles.hero}>
        <DetailsSkeleton rows={3} />
      </header>
      <div className={styles.body}>
        {[2, 4].map((rows) => (
          <section key={rows} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.skeletonRow} style={{ width: 64 }} />
            </div>
            <div className={styles.card}>
              <DetailsSkeleton rows={rows} />
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

/** A value that takes you somewhere else in the app, e.g. the parent changeset. */
export function DetailsLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className={styles.link} onClick={onClick}>
      {children}
    </button>
  );
}
