import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { withoutAction, type MenuEntry } from '../lib/actions';
import { displayName } from '../lib/userName';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { ActionDropdownMenu } from './menu/ActionDropdownMenu';
import { MoreDetails } from './MoreDetails';
import type { Property } from './PropertyList';
import { RelativeTime } from './RelativeTime';
import styles from './DetailsPanel.module.css';

// The parts a details panel is made of, where every view imports them from.
export { DetailsBadge } from './DetailsBadge';
export { DetailsChangesPane } from './DetailsChangesPane';
export { DetailsCopyable } from './DetailsCopyable';
export { DetailsLink } from './DetailsLink';
export { DetailsPanelSkeleton } from './DetailsPanelSkeleton';
export { DetailsEmpty, DetailsSection, DetailsSkeleton } from './DetailsSection';

interface DetailsPanelProps {
  icon: ReactNode;
  /** What the object is, e.g. "Branch" or "Changeset". */
  kind: string;
  /** Where it lives, e.g. a file's folder; in the meta row after the author. */
  context?: ReactNode;
  /** The title and description (a `DetailsHeading`). */
  heading: ReactNode;
  /** Who created it and when (an empty date for what has none yet), first in the meta row under the heading. */
  author?: { user: string; date: string };
  /** More of the meta row after the date: its id to copy, its branch... Separated by dots, wrapping when narrow. */
  meta?: ReactNode[];
  /** Small status pills such as "Current" or "Hidden", next to the kind. */
  badges?: ReactNode;
  /** Attribute chips, under the meta row. */
  attributes?: ReactNode;
  /** The one main thing to do with the object, the same as double-clicking or pressing Enter on it: usually "Open diff". */
  primaryAction?: ReactNode;
  /** The object's context menu, behind a "More actions" button next to the primary action. */
  menu?: MenuEntry[];
  /** The menu entry the primary action repeats, left out of the menu. */
  primaryActionId?: string;
  /** Created date, parent, repository, GUID...: behind a "More details" disclosure. */
  properties?: Property[];
  /** The changed files, in a pane of their own under the rest (a `DetailsChangesPane`). */
  changes?: ReactNode;
  /** The body fills the panel without padding or scrolling, e.g. for a diff. */
  fill?: boolean;
  /** Sections of their own, under the heading. */
  children?: ReactNode;
}

/** The side panel describing the object selected in a list or graph. */
export function DetailsPanel({
  icon,
  kind,
  context,
  heading,
  author,
  meta = [],
  badges,
  attributes,
  primaryAction,
  menu = [],
  primaryActionId,
  properties = [],
  changes,
  fill = false,
  children,
}: DetailsPanelProps) {
  const moreActions = primaryActionId ? withoutAction(menu, primaryActionId) : menu;
  const metaItems = [
    author && <AuthorLine key="author" {...author} />,
    context && (
      <span key="context" className={styles.context} data-tip-overflow data-tip={typeof context === 'string' ? context : undefined}>
        {context}
      </span>
    ),
    ...meta,
  ].filter(Boolean);

  return (
    <aside className={styles.panel} data-fill={fill}>
      <div className={styles.top}>
        <header className={styles.hero}>
          <div className={styles.kindRow}>
            <span className={styles.icon}>{icon}</span>
            <span className={styles.kind}>{kind}</span>
            {badges && <span className={styles.badges}>{badges}</span>}
            <span className={styles.actions}>
              {primaryAction}
              {moreActions.length > 0 && (
                <ActionDropdownMenu entries={moreActions}>
                  <IconButton size="small" variant="ghost" icon={<MoreHorizontal size={15} />} label="More actions" />
                </ActionDropdownMenu>
              )}
            </span>
          </div>
          {heading}
          {metaItems.length > 0 && (
            <div className={styles.metaRow}>
              <div className={styles.metaList}>
                {metaItems.map((item, index) => (
                  <span key={index} className={styles.metaItem}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          {attributes}
          {properties.length > 0 && <MoreDetails properties={properties} />}
        </header>
        {children && <div className={styles.body}>{children}</div>}
      </div>
      {changes}
    </aside>
  );
}

function AuthorLine({ user, date }: { user: string; date: string }) {
  return (
    <span className={styles.author}>
      <Avatar user={user} size={18} />
      <span className={styles.authorName}>{displayName(user)}</span>
      {date && (
        <>
          <span className={styles.dot}>·</span>
          <RelativeTime date={date} />
        </>
      )}
    </span>
  );
}
