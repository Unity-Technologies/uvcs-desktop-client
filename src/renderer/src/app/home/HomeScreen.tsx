import { FolderDown } from 'lucide-react';
import { useState } from 'react';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useServers } from '../workspace/workspaceQueries';
import { HomeSidebar } from './HomeSidebar';
import type { HomeSection } from './homeSection';
import { RepositoriesPanel } from './RepositoriesPanel';
import { useFolderDrop } from './useFolderDrop';
import { useHomeCommands } from './useHomeCommands';
import { WelcomePanel } from './WelcomePanel';
import { WorkspacesPanel } from './WorkspacesPanel';
import styles from './Home.module.css';

export function HomeScreen() {
  const [section, setSection] = useState<HomeSection>({ kind: 'welcome' });
  const { data: servers } = useServers();
  const firstServer = servers?.[0]?.server;
  const open = useOpenWorkspace();
  const drop = useFolderDrop(open);
  useHomeCommands(open);
  const openFolder = (): void => void openWorkspaceFolder(open);

  return (
    <div className={styles.home} onDragOver={drop.onDragOver} onDragLeave={drop.onDragLeave} onDrop={drop.onDrop}>
      <HomeSidebar section={section} onSelect={setSection} />
      <main className={styles.main}>
        <div className={styles.dragRegion} data-drag-region />
        <div className={styles.panel} key={section.kind === 'server' ? section.server : section.kind}>
          {section.kind === 'server' ? (
            <RepositoriesPanel server={section.server} onOpen={open} />
          ) : section.kind === 'all' ? (
            <WorkspacesPanel onOpen={open} onOpenFolder={openFolder} />
          ) : (
            <WelcomePanel
              onOpen={open}
              onOpenFolder={openFolder}
              onBrowseRepositories={firstServer ? () => setSection({ kind: 'server', server: firstServer }) : undefined}
            />
          )}
        </div>
      </main>
      {drop.isDraggingOver && (
        <div className={styles.dropOverlay}>
          <FolderDown size={28} />
          <span>Drop a folder to open or create a workspace</span>
        </div>
      )}
    </div>
  );
}
