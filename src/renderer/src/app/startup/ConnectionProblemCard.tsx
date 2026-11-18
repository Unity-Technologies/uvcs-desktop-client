import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { openDialog } from '../../ui/dialog/dialogStore';
import { IconButton } from '../../ui/IconButton';
import { CornerCard, CornerCardText } from '../../ui/toast/CornerCard';
import { checkSessionNow, useWindowSessionCheck } from '../signIn/useSessionCheck';
import { useSession } from '../workspace/sessionStore';
import { ConnectionProblemDialog } from './ConnectionProblemDialog';
import { connectionProblemShown } from './connectionProblemShown';
import { connectionProblemWords } from './connectionProblemWords';

/**
 * The corner card of the window's place's server out of reach, while a workspace keeps working with what's local
 * (`connectionProblemShown`). The check runs once the server is known: a repository's at once, a workspace's once its
 * info names it (`useWindowSessionCheck`).
 */
export function ConnectionProblemCard() {
  const place = useSession((state) => state.place);
  const client = useQueryClient();
  const { check } = useWindowSessionCheck();
  const [dismissedServer, setDismissedServer] = useState<string | null>(null);
  const problem = connectionProblemShown(check.data, { placeOpen: place !== null, dismissedServer });
  if (!problem) return null;

  const { title, explanation } = connectionProblemWords(problem);
  const checking = check.isFetching;
  return (
    <CornerCard
      role="status"
      icon={<CloudOff size={15} />}
      title={title}
      trailing={<IconButton icon={<X size={13} />} label="Dismiss" size="small" onClick={() => setDismissedServer(problem.server)} />}
      actions={
        <>
          <Button
            variant="ghost"
            size="small"
            onClick={() => openDialog((close) => <ConnectionProblemDialog title={title} explanation={explanation} details={problem} onClose={close} />)}
          >
            Details
          </Button>
          <Button
            variant="primary"
            size="small"
            icon={<RefreshCw size={13} className={checking ? 'spinning' : undefined} />}
            onClick={() => void checkSessionNow(client, problem.server)}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Retry'}
          </Button>
        </>
      }
    >
      <CornerCardText>{explanation}</CornerCardText>
    </CornerCard>
  );
}
