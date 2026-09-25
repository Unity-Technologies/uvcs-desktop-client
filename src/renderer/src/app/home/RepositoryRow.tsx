import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { displayName } from '../../lib/userName';
import { Button } from '../../ui/Button';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { repositoryMenu } from './homeMenus';
import { RepositoryAvatar } from './RepositoryAvatar';
import { WorkspaceRow } from './WorkspaceRow';
import styles from './Home.module.css';

interface RepositoryRowProps {
  repository: RepositorySummary;
  /** The workspaces known to work on the repository. */
  workspaces: WorkspaceSummary[];
  onOpen: (path: string) => void;
  onCreateWorkspace: (repository: RepositorySummary) => void;
}

export function RepositoryRow({ repository, workspaces, onOpen, onCreateWorkspace }: RepositoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const menu = () => repositoryMenu(repository, onCreateWorkspace);
  const onlyWorkspace = workspaces.length === 1 ? workspaces[0] : undefined;

  return (
    <div className={styles.repository}>
      <ActionContextMenu entries={menu}>
        <div className={styles.row}>
          <button className={styles.rowMain} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
            <ChevronRight size={14} className={styles.chevron} data-expanded={expanded} />
            <RepositoryAvatar name={repository.name} size={32} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>
                <Highlight text={repository.name} />
              </span>
              <span className={styles.rowSubtitle}>
                {[
                  workspaces.length > 0 && `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}`,
                  repository.owner && `created by ${displayName(repository.owner)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </button>
          {onlyWorkspace ? (
            <Button size="small" onClick={() => onOpen(onlyWorkspace.path)}>
              Open
            </Button>
          ) : (
            workspaces.length === 0 && (
              <Button size="small" onClick={() => onCreateWorkspace(repository)}>
                New workspace
              </Button>
            )
          )}
          <ActionDropdownMenu entries={menu()}>
            <Button variant="ghost" size="small" className={styles.rowMenu} icon={<MoreHorizontal size={15} />} aria-label="Repository actions" />
          </ActionDropdownMenu>
        </div>
      </ActionContextMenu>

      {expanded && (
        // The filter matches repository names only, not their workspaces.
        <HighlightQuery query="">
          <div className={styles.nested}>
            {workspaces.map((workspace) => (
              <WorkspaceRow key={workspace.guid} workspace={workspace} onOpen={onOpen} compact />
            ))}
            <button className={styles.nestedAction} onClick={() => onCreateWorkspace(repository)}>
              + New workspace for {repository.name}
            </button>
          </div>
        </HighlightQuery>
      )}
    </div>
  );
}
