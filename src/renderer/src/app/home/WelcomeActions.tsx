import { Database, FolderOpen, FolderPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import styles from './Home.module.css';

interface WelcomeActionsProps {
  onOpen: (path: string) => void;
  onOpenFolder: () => void;
  onBrowseRepositories?: () => void;
}

/** The three ways to start: a workspace already on disk, a new one from a repository, or a look around first. */
export function WelcomeActions({ onOpen, onOpenFolder, onBrowseRepositories }: WelcomeActionsProps) {
  return (
    <div className={styles.actions}>
      <ActionCard
        icon={<FolderOpen size={18} />}
        title="Open workspace folder…"
        description="A folder on this computer that already holds a workspace."
        onClick={onOpenFolder}
      />
      <ActionCard
        icon={<FolderPlus size={18} />}
        title="Create a workspace…"
        description="Download a repository from Unity Cloud or your server into a new folder."
        onClick={() => openCreateWorkspaceDialog({ onCreated: onOpen })}
        primary
      />
      <ActionCard
        icon={<Database size={18} />}
        title="Browse repositories"
        description="See what your organizations and servers hold, and create new ones."
        onClick={onBrowseRepositories}
      />
    </div>
  );
}

interface ActionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** Missing while it can't be done yet, e.g. no server is known. */
  onClick?: () => void;
  primary?: boolean;
}

function ActionCard({ icon, title, description, onClick, primary = false }: ActionCardProps) {
  return (
    <button className={styles.actionCard} data-primary={primary} disabled={!onClick} onClick={onClick}>
      <span className={styles.actionIcon}>{icon}</span>
      <span className={styles.actionTitle}>{title}</span>
      <span className={styles.actionText}>{description}</span>
    </button>
  );
}
