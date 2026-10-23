import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { ROVING_ITEM } from '../../lib/rovingFocus';
import { pluralize } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { Button } from '../../ui/Button';
import { Highlight } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { windowAskedBy, workspaceOpener } from '../workspace/workspaceWindowChoice';
import { repositoryMenu } from './homeMenus';
import { repositoryLabels } from './repositoryProjects';
import styles from './Home.module.css';

interface RepositoryRowProps {
  repository: RepositorySummary;
  /** The Unity project the list shows, none for all projects (`repositoryLabels`). */
  project: string | null;
  /** The workspaces known to work on the repository. */
  workspaces: WorkspaceSummary[];
  /** Its workspaces show under it (`repositoryListRows`). */
  expanded: boolean;
  onToggle: () => void;
  onOpen: (path: string) => void;
  onCreateWorkspace: (repository: RepositorySummary) => void;
}

export function RepositoryRow({ repository, project, workspaces, expanded, onToggle, onOpen, onCreateWorkspace }: RepositoryRowProps) {
  const menu = () => repositoryMenu(repository, onCreateWorkspace);
  const onlyWorkspace = workspaces.length === 1 ? workspaces[0] : undefined;
  const title = repositoryLabels(repository, project);
  const details = [
    workspaces.length > 0 && pluralize(workspaces.length, 'workspace'),
    repository.owner && `created by ${displayName(repository.owner)}`,
  ].filter(Boolean);

  return (
    <ActionContextMenu entries={menu}>
      <div className={styles.row}>
        <button className={styles.rowMain} onClick={onToggle} aria-expanded={expanded} {...ROVING_ITEM}>
          <ChevronRight size={14} className={styles.chevron} data-expanded={expanded} />
          <RepositoryAvatar repository={repository.spec} label={title.name} size={32} />
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              {/* In a box of its own: the title's gap would open between the pieces a match splits the name into. */}
              <span>
                <Highlight text={title.name} />
              </span>
            </span>
            <span className={styles.rowSubtitle}>
              {title.project && (
                <>
                  Project <Highlight text={title.project} />
                  {details.length > 0 && ' · '}
                </>
              )}
              {details.join(' · ')}
            </span>
          </span>
        </button>
        {onlyWorkspace ? (
          <Button size="small" onClick={(event) => workspaceOpener(onOpen)(onlyWorkspace.path, windowAskedBy(event))}>
            Open
          </Button>
        ) : (
          // On every row it would read as a wall of buttons: it shows on the row under the pointer or the keyboard.
          workspaces.length === 0 && (
            <Button size="small" className={styles.rowCreate} onClick={() => onCreateWorkspace(repository)}>
              New workspace
            </Button>
          )
        )}
        <ActionDropdownMenu entries={menu()}>
          <Button variant="ghost" size="small" className={styles.rowMenu} icon={<MoreHorizontal size={15} />} aria-label="Repository actions" />
        </ActionDropdownMenu>
      </div>
    </ActionContextMenu>
  );
}
