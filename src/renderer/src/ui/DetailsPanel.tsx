import { ChevronRight, Copy, MoreHorizontal } from 'lucide-react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { withoutAction, type MenuEntry } from '../lib/actions';
import { copyToClipboard } from '../lib/copyToClipboard';
import { displayName } from '../lib/userName';
import { Avatar } from './Avatar';
import { CHANGES_HEIGHT, useDetailsLayoutStore } from './detailsLayoutStore';
import { IconButton } from './IconButton';
import { ActionDropdownMenu } from './menu/ActionDropdownMenu';
import { PropertyList, type Property } from './PropertyList';
import { RelativeTime } from './RelativeTime';
import { ResizeHandle } from './ResizeHandle';
import styles from './DetailsPanel.module.css';

interface DetailsPanelProps {
  icon: ReactNode;
  /** What the object is, e.g. "Branch" or "Changeset". */
  kind: string;
  /** Where it lives, e.g. a file's folder; in the meta row after the author. */
  context?: ReactNode;
  /** The title and description (a `DetailsHeading`). */
  heading: ReactNode;
  /** Who created it and when, first in the meta row under the heading. */
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
      <span className={styles.dot}>·</span>
      <RelativeTime date={date} />
    </span>
  );
}

function MoreDetails({ properties }: { properties: Property[] }) {
  const { moreDetailsOpen: open, set } = useDetailsLayoutStore();
  return (
    <div className={styles.moreDetails}>
      <button className={styles.disclosure} aria-expanded={open} onClick={() => set({ moreDetailsOpen: !open })}>
        <ChevronRight size={13} className={styles.chevron} />
        More details
      </button>
      {open && (
        <div className={styles.properties}>
          <PropertyList properties={properties} />
        </div>
      )}
    </div>
  );
}

interface DetailsChangesPaneProps {
  /** e.g. "Changes" or "12 files changed". */
  title: ReactNode;
  /** A small control at the right of the title. */
  action?: ReactNode;
  /** The list is shown: the pane gets a splitter and fills the space left, at least as tall as it was sized. */
  expanded: boolean;
  children: ReactNode;
}

/** The pane at the bottom of a details panel listing what the object changed, resizable once the list shows. */
export function DetailsChangesPane({ title, action, expanded, children }: DetailsChangesPaneProps) {
  const { changesHeight, set } = useDetailsLayoutStore();
  const paneRef = useRef<HTMLElement>(null);

  return (
    <section ref={paneRef} className={styles.changes} data-expanded={expanded} style={{ '--changes-height': `${changesHeight}px` } as CSSProperties}>
      {expanded && (
        <ResizeHandle
          size={changesHeight}
          min={CHANGES_HEIGHT.min}
          max={CHANGES_HEIGHT.max}
          measure={() => paneRef.current?.offsetHeight ?? changesHeight}
          onResize={(height) => set({ changesHeight: height })}
        />
      )}
      <div className={styles.changesHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** An identifier in the meta row (`cs:42`, a GUID's start) that copies the full value. */
export function DetailsCopyable({ text, copyText = text, what }: { text: string; copyText?: string; what: string }) {
  return (
    <button className={styles.copyable} onClick={() => copyToClipboard(copyText, what)} data-tip={`Copy ${what.toLowerCase()}: ${copyText}`}>
      <span className="mono">{text}</span>
      <Copy size={11} className={styles.copyIcon} />
    </button>
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

/** The whole panel while the list it describes loads: the hero's shape, then the changes pane. */
export function DetailsPanelSkeleton() {
  return (
    <aside className={styles.panel} aria-busy="true" aria-label="Loading">
      <div className={styles.top}>
        <header className={styles.hero}>
          <DetailsSkeleton rows={4} />
        </header>
      </div>
      <section className={styles.changes} data-expanded={false}>
        <div className={styles.changesHeader}>
          <span className={styles.skeletonRow} style={{ width: 64 }} />
        </div>
      </section>
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
