import { GitBranch } from 'lucide-react';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';

/** Shows what the workspace is loaded from. */
export function WorkingObjectButton() {
  const { data: workspace } = useWorkspaceInfo();
  return (
    <Button variant="ghost" icon={<GitBranch size={14} />}>
      {workspace?.selector.name ?? '…'}
    </Button>
  );
}
