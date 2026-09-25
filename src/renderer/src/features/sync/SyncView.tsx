import { useState } from 'react';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { CenteredSpinner } from '../../ui/Spinner';
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
      {!workspace ? (
        <CenteredSpinner />
      ) : mode === 'repository' ? (
        <RepositorySyncPanel localRepository={workspace.repository} />
      ) : (
        <GitSyncPanel localRepository={workspace.repository} />
      )}
    </>
  );
}
