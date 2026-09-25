import { FolderDown } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../settings/useSettings';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { HomeSidebar } from './HomeSidebar';
import type { HomeSection } from './homeSection';
import { RepositoriesPanel } from './RepositoriesPanel';
import { useFolderDrop } from './useFolderDrop';
import { WorkspacesPanel } from './WorkspacesPanel';
import styles from './Home.module.css';

export function HomeScreen() {
  const { recentWorkspacePaths } = useSettings();
  const [chosenSection, setSection] = useState<HomeSection | null>(null);
  const section: HomeSection = chosenSection ?? { kind: recentWorkspacePaths.length > 0 ? 'recent' : 'all' };
  const open = useOpenWorkspace();
  const drop = useFolderDrop(open);

  return (
    <div className={styles.home} onDragOver={drop.onDragOver} onDragLeave={drop.onDragLeave} onDrop={drop.onDrop}>
      <HomeSidebar section={section} onSelect={setSection} />
      <main className={styles.main}>
        <div className={styles.dragRegion} />
        {section.kind === 'server' ? (
          <RepositoriesPanel key={section.server} server={section.server} onOpen={open} />
        ) : (
          <WorkspacesPanel
            key={section.kind}
            mode={section.kind}
            onOpen={open}
            onOpenFolder={() => void openWorkspaceFolder(open)}
            onShowAll={() => setSection({ kind: 'all' })}
          />
        )}
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
