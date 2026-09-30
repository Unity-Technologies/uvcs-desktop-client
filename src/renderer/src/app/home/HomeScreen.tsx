import { FolderDown } from 'lucide-react';
import { useState } from 'react';
import { useFolderDrop } from '../folderDrop/useFolderDrop';
import { openFolder, openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useServers } from '../workspace/workspaceQueries';
import { HomeSidebar } from './HomeSidebar';
import type { HomeSection } from './homeSection';
import { RepositoriesPanel } from './RepositoriesPanel';
import { useHomeCommands } from './useHomeCommands';
import { WelcomePanel } from './WelcomePanel';
import { WorkspacesPanel } from './WorkspacesPanel';
import styles from './Home.module.css';

export function HomeScreen() {
  const [section, setSection] = useState<HomeSection>({ kind: 'welcome' });
  const { data: servers } = useServers();
  const firstServer = servers?.[0]?.server;
  const open = useOpenWorkspace();
  const drop = useFolderDrop((event) => {
    const file = event.dataTransfer?.files[0];
    if (file) void openFolder(window.uvcs.pathForFile(file), open);
  });
  useHomeCommands(open);
  const pickFolder = (): void => void openWorkspaceFolder(open);

  return (
    <div className={styles.home}>
      <HomeSidebar section={section} onSelect={setSection} />
      <main className={styles.main}>
        <div className={styles.dragRegion} />
        <div className={styles.panel} key={section.kind === 'server' ? section.server : section.kind}>
          {section.kind === 'server' ? (
            <RepositoriesPanel server={section.server} onOpen={open} />
          ) : section.kind === 'all' ? (
            <WorkspacesPanel onOpen={open} onOpenFolder={pickFolder} />
          ) : (
            <WelcomePanel
              onOpen={open}
              onOpenFolder={pickFolder}
              onBrowseRepositories={firstServer ? () => setSection({ kind: 'server', server: firstServer }) : undefined}
            />
          )}
        </div>
      </main>
      {drop.isOver && (
        <div className={styles.dropOverlay}>
          <FolderDown size={28} />
          <span>Drop a folder to open or create a workspace</span>
        </div>
      )}
    </div>
  );
}
