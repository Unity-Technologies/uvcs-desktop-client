import { forwardRef, useImperativeHandle, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { focusFirstItem, moveRovingFocus } from '../../lib/rovingFocus';
import { HighlightQuery } from '../../ui/Highlight';
import type { WorkspaceEntry } from './recentWorkspaces';
import { firstMatch, searchedSections } from './searchedSections';
import { WorkspaceRow } from './WorkspaceRow';
import styles from './Home.module.css';

const ROWS = '[data-workspace-row]';

export interface WorkspaceListSection {
  id: string;
  /** Shown above its rows; a list of one section can go without. */
  title?: string;
  entries: WorkspaceEntry[];
  /** Shown instead of the rows when there are none, without a search. */
  empty?: ReactNode;
}

export interface WorkspaceListHandle {
  /** Keys of the search field above the list: ↓ moves into the list, Enter opens the first match. */
  takeSearchKey: (event: KeyboardEvent<HTMLInputElement>) => void;
}

interface WorkspaceListProps {
  sections: WorkspaceListSection[];
  /** The search the rows are filtered by, highlighted in them. */
  query: string;
  /** Shown instead of every section when the search matches nothing. */
  noMatches: ReactNode;
  onOpen: (path: string) => void;
  /** ↑ on the first row: back to whatever leads into the list (the search field). */
  onLeaveTop?: () => void;
}

/**
 * The home screen's workspaces, in titled sections read as one list: ↑ and ↓ (and Page Up / Down) move between rows
 * across sections, Enter or a click opens one; Enter in the search field opens the first match.
 */
export const WorkspaceList = forwardRef<WorkspaceListHandle, WorkspaceListProps>(function WorkspaceList({ sections, query, noMatches, onOpen, onLeaveTop }, ref) {
  const listRef = useRef<HTMLDivElement>(null);
  const shown = searchedSections(sections, query);
  const first = query.trim() ? firstMatch(shown) : undefined;
  useImperativeHandle(ref, () => ({
    takeSearchKey: (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusFirstItem(listRef.current, ROWS);
      } else if (event.key === 'Enter' && first) {
        event.preventDefault();
        onOpen(first.workspace.path);
      }
    },
  }));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => moveRovingFocus(event.currentTarget, event, onLeaveTop, ROWS);

  return (
    <HighlightQuery query={query}>
      <div ref={listRef} className={styles.sections} onKeyDown={onKeyDown}>
        {shown.length === 0 && noMatches}
        {shown.map((section) => (
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
