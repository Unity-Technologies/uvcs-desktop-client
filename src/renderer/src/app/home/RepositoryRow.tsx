import { ChevronRight, FolderPlus, MoreHorizontal } from 'lucide-react';
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
import { exploreRepository } from '../workspace/exploreRepository';
import { windowAskedBy, workspaceOpener } from '../workspace/workspaceWindowChoice';
import { DeletedChip } from './DeletedChip';
import { deletedRepositoriesTip } from './deletedRepositories';
import { deletedRepositoryMenu, repositoryMenu } from './homeMenus';
import { restoreRepository } from './homeOperations';
import { repositoryLabels } from './repositoryProjects';
import { repositoryRowActionOf } from './repositoryRowAction';
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
  const deleted = repository.deleted ?? false;
  const menu = () => (deleted ? deletedRepositoryMenu(repository) : repositoryMenu(repository, onCreateWorkspace));
  const action = repositoryRowActionOf(repository, workspaces);
  const title = repositoryLabels(repository, project);
  const details = [
    workspaces.length > 0 && pluralize(workspaces.length, 'workspace'),
    repository.owner && `created by ${displayName(repository.owner)}`,
  ].filter(Boolean);

  return (
    <ActionContextMenu entries={menu}>
      <div className={styles.row} data-deleted={deleted}>
        <button className={styles.rowMain} onClick={deleted ? undefined : onToggle} aria-expanded={deleted ? undefined : expanded} {...ROVING_ITEM}>
          <ChevronRight size={14} className={styles.chevron} data-expanded={expanded} data-hidden={deleted} />
          <RepositoryAvatar repository={repository.spec} label={title.name} size={32} className={styles.rowAvatar} />
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
          {deleted && <DeletedChip tip={deletedRepositoriesTip(repository.server)} />}
        </button>
        {action.kind === 'restore' && (
          <Button size="small" onClick={() => void restoreRepository(repository)}>
            Restore
          </Button>
        )}
        {action.kind === 'open' && (
          <Button size="small" onClick={(event) => workspaceOpener(onOpen)(action.workspace.path, windowAskedBy(event))}>
            Open
          </Button>
        )}
        {/* On every row they would read as a wall of buttons: they show on the row under the pointer or the keyboard. */}
        {action.kind === 'create' && (
          <>
            <Button
              variant="ghost"
              size="small"
              className={styles.rowCreate}
              data-tip="Browse its history without downloading it"
              onClick={(event) => exploreRepository(repository.spec, windowAskedBy(event))}
            >
              Explore
            </Button>
            <Button size="small" className={styles.rowCreate} icon={<FolderPlus size={14} />} onClick={() => onCreateWorkspace(repository)}>
              New workspace
            </Button>
          </>
        )}
        <ActionDropdownMenu entries={menu()}>
          <Button variant="ghost" size="small" className={styles.rowMenu} icon={<MoreHorizontal size={15} />} aria-label="Repository actions" />
        </ActionDropdownMenu>
      </div>
    </ActionContextMenu>
  );
}
