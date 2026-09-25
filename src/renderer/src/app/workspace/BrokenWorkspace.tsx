import { AlertTriangle, ArrowLeft, FileText, RefreshCw } from 'lucide-react';
import { lastSegment } from '../../lib/paths';
import { Button } from '../../ui/Button';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { errorDetailsAction } from '../errors/errorDetailsAction';
import { useSession } from './sessionStore';

interface BrokenWorkspaceProps {
  path: string;
  error: Error;
  retrying: boolean;
  onRetry: () => void;
}

/** Shown instead of the workspace when its folder is there but `cm` can't read it as a workspace. */
export function BrokenWorkspace({ path, error, retrying, onRetry }: BrokenWorkspaceProps) {
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const title = `“${lastSegment(path)}” can't be opened`;
  const details = errorDetailsAction(title, error);

  return (
    <ScreenMessage
      icon={<AlertTriangle size={26} />}
      tone="warning"
      title={title}
      actions={
        <>
          <Button variant="primary" icon={<RefreshCw size={14} className={retrying ? 'spinning' : undefined} />} onClick={onRetry}>
            Try again
          </Button>
          {details && (
            <Button icon={<FileText size={14} />} onClick={details.run}>
              {details.label}
            </Button>
          )}
          <Button icon={<ArrowLeft size={14} />} onClick={closeWorkspace}>
            All workspaces
          </Button>
        </>
      }
    >
      <p className="selectable">{error.message}</p>
      <p>
        <code className="selectable">{path}</code>
      </p>
    </ScreenMessage>
  );
}
