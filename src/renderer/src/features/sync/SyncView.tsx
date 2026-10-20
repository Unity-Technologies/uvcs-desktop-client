import { useState } from 'react';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ViewHeader } from '../../ui/ViewHeader';
import { GitSyncPanel } from './GitSyncPanel';
import { RepositorySyncPanel } from './RepositorySyncPanel';

type SyncMode = 'repository' | 'git';

export function SyncView() {
  const [mode, setMode] = useState<SyncMode>('repository');
  const { data: workspace } = useWorkspaceInfo();

  return (
    <>
      <ViewHeader title="Sync" subtitle={workspace?.repository}>
        <SegmentedControl<SyncMode>
          value={mode}
          onChange={setMode}
          segments={[
            { value: 'repository', label: 'Another repository' },
            { value: 'git', label: 'Git' },
          ]}
        />
      </ViewHeader>
      {/* Before the workspace's info names the repository, the panel shows its layout with placeholders. */}
      {mode === 'repository' || !workspace ? (
        <RepositorySyncPanel localRepository={workspace?.repository} />
      ) : (
        <GitSyncPanel localRepository={workspace.repository} />
      )}
    </>
  );
}
