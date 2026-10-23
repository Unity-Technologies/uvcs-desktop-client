import { useCallback, useEffect } from 'react';
import type { UnityProject } from '@shared/domain/repository';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useProjects, useServers } from '../workspace/workspaceQueries';
import { TopBar } from '../shell/TopBar';
import { BackToWorkspaceButton } from './BackToWorkspaceButton';
import { homeLink } from './homeLink';
import { HomeSidebar } from './HomeSidebar';
import { WELCOME } from './homeSection';
import { useHomeSection } from './homeSectionStore';
import { RepositoriesPanel } from './RepositoriesPanel';
import { useProjectPickStore } from './projectPickStore';
import { shownProject } from './repositoryProjects';
import { useHomeCommands } from './useHomeCommands';
import { WelcomePanel } from './WelcomePanel';
import { WorkspacesPanel } from './WorkspacesPanel';
import styles from './Home.module.css';

const NO_PROJECTS: UnityProject[] = [];

export function HomeScreen() {
  const section = useHomeSection((state) => state.section);
  const setSection = useHomeSection((state) => state.show);
  const { data: servers } = useServers();
  const firstServer = servers?.[0]?.server;
  const open = useOpenWorkspace();
  const goHome = useCallback(() => setSection(WELCOME), [setSection]);
  // The home screen starts on its welcome each time a window comes back to it, as it did when it held its own state.
  useEffect(() => goHome, [goHome]);
  const shownServer = section.kind === 'server' ? section.server : '';
  const { data: projects = NO_PROJECTS } = useProjects(section.kind === 'server' ? section.server : null);
  const project = shownProject(useProjectPickStore((state) => state.picks[shownServer]), projects);
  useHomeCommands(open, goHome, homeLink(section, project?.name ?? null));
  const openFolder = (): void => void openWorkspaceFolder(open);

  return (
    <div className={styles.home}>
      <TopBar atHome onHome={goHome}>
        <BackToWorkspaceButton />
      </TopBar>
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
