import { forwardRef, useImperativeHandle, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { navigationTarget } from '../../lib/listNavigation';
import { HighlightQuery } from '../../ui/Highlight';
import type { WorkspaceEntry } from './recentWorkspaces';
import { WorkspaceRow } from './WorkspaceRow';
import styles from './Home.module.css';

export interface WorkspaceListSection {
  id: string;
  /** Shown above its rows; a list of one section can go without. */
  title?: string;
  entries: WorkspaceEntry[];
  /** Shown instead of the rows when there are none. */
  empty?: ReactNode;
}

export interface WorkspaceListHandle {
  /** Moves the keyboard into the list, e.g. on ↓ in the search field above it. */
  focusFirst: () => void;
}

interface WorkspaceListProps {
  sections: WorkspaceListSection[];
  /** The search the rows are filtered by, highlighted in them. */
  query: string;
  onOpen: (path: string) => void;
  /** ↑ on the first row: back to whatever leads into the list (the search field). */
  onLeaveTop?: () => void;
}

/**
 * The home screen's workspaces, in titled sections read as one list: ↑ and ↓ (and Page Up / Down) move between rows
 * across sections, Enter or a click opens one.
 */
export const WorkspaceList = forwardRef<WorkspaceListHandle, WorkspaceListProps>(function WorkspaceList({ sections, query, onOpen, onLeaveTop }, ref) {
  const listRef = useRef<HTMLDivElement>(null);
  const rows = (): HTMLElement[] => [...(listRef.current?.querySelectorAll<HTMLElement>('[data-workspace-row]') ?? [])];
  useImperativeHandle(ref, () => ({ focusFirst: () => rows()[0]?.focus() }), []);

  const onKeyDown = (event: KeyboardEvent): void => {
    const all = rows();
    const current = all.indexOf(event.target as HTMLElement);
    if (current === -1) return;
    if (event.key === 'ArrowUp' && current === 0 && onLeaveTop) {
      event.preventDefault();
      onLeaveTop();
      return;
    }
    const target = navigationTarget(event.key, current, all.length);
    if (target === null) return;
    event.preventDefault();
    all[target]!.focus();
    all[target]!.scrollIntoView({ block: 'nearest' });
  };

  return (
    <HighlightQuery query={query}>
      <div ref={listRef} className={styles.sections} onKeyDown={onKeyDown}>
        {sections.map((section) => (
          <section key={section.id} className={styles.section} aria-label={section.title}>
            {section.title && (
              <h2 className={styles.sectionTitle}>
                {section.title}
                {section.entries.length > 0 && <span className={styles.sectionCount}>{section.entries.length}</span>}
              </h2>
            )}
            {section.entries.length === 0
              ? section.empty
              : section.entries.map(({ workspace, missing, repository, selector }) => (
                  <WorkspaceRow
                    key={workspace.guid}
                    workspace={workspace}
                    repository={repository}
                    selector={selector}
                    missing={missing}
                    onOpen={onOpen}
                  />
                ))}
          </section>
        ))}
      </div>
    </HighlightQuery>
  );
});
