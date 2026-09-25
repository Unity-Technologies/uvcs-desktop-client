import { FolderDown } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client';
import { toast } from '../../ui/toast/toastStore';
import { useSettings } from '../settings/useSettings';
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

  const openFolder = async (): Promise<void> => {
    const directory = await api.system.pickDirectory('Open a workspace folder');
    if (!directory) return;
    const root = await api.workspaces.findRoot(directory);
    if (root) open(root);
    else toast.error('That folder is not inside a workspace', 'Drop it on this window to create a workspace there.');
  };

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
            onOpenFolder={() => void openFolder()}
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
