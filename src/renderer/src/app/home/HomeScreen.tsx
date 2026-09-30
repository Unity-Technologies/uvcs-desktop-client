import { useState } from 'react';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useServers } from '../workspace/workspaceQueries';
import { TopBar } from '../shell/TopBar';
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
  useHomeCommands(open);
  const openFolder = (): void => void openWorkspaceFolder(open);

  return (
    <div className={styles.home}>
      <TopBar />
      <div className={styles.body}>
        <HomeSidebar section={section} onSelect={setSection} />
        <main className={styles.main}>
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
      </div>
    </div>
  );
}
