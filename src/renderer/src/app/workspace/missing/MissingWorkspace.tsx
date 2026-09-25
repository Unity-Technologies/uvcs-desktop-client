import { ArrowLeft, FolderSearch, FolderX, RefreshCw, RotateCcw, X } from 'lucide-react';
import { lastSegment } from '../../../lib/paths';
import { Button } from '../../../ui/Button';
import { ScreenMessage } from '../../../ui/ScreenMessage';
import { useOpenWorkspace } from '../useOpenWorkspace';
import { useSession } from '../sessionStore';
import { forgetMissingWorkspace, locateWorkspace } from './missingWorkspaceActions';
import { openRecreateWorkspaceDialog } from './RecreateWorkspaceDialog';

interface MissingWorkspaceProps {
  path: string;
  /** True while "Look again" re-checks the folder. */
  checking: boolean;
  onLookAgain: () => void;
}

/** Shown instead of the workspace when its folder is gone, with the ways to get it back. */
export function MissingWorkspace({ path, checking, onLookAgain }: MissingWorkspaceProps) {
  // `cm` no longer lists a workspace whose folder is gone, so its folder name stands in for its name.
  const name = lastSegment(path);
  const open = useOpenWorkspace();
  const closeWorkspace = useSession((state) => state.closeWorkspace);

  return (
    <ScreenMessage
      icon={<FolderX size={26} />}
      tone="warning"
      title={`“${name}” can't be found`}
      actions={
        <>
          <Button variant="primary" icon={<FolderSearch size={14} />} onClick={() => void locateWorkspace(name, path, open)}>
            Locate…
          </Button>
          <Button icon={<RotateCcw size={14} />} onClick={() => openRecreateWorkspaceDialog({ name, path })}>
            Recreate…
          </Button>
          <Button icon={<X size={14} />} onClick={() => void forgetMissingWorkspace(path)}>
            Remove from list
          </Button>
        </>
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="small"
            icon={<RefreshCw size={13} className={checking ? 'spinning' : undefined} />}
            onClick={onLookAgain}
          >
            {checking ? 'Looking…' : 'Restored it? Look again'}
          </Button>
          <Button variant="ghost" size="small" icon={<ArrowLeft size={13} />} onClick={closeWorkspace}>
            All workspaces
          </Button>
        </>
      }
    >
      <p>
        Its folder is no longer at <code className="selectable">{path}</code>. It may have been moved, deleted, or be on a drive that isn't
        connected.
      </p>
    </ScreenMessage>
  );
}
