import { Download } from 'lucide-react';
import type { ConnectionProblem } from '@shared/domain/setup';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { OutputBlock } from '../../ui/OutputBlock';
import { connectionProblemWords } from './connectionProblemWords';
import { DOWNLOAD_URL } from './installGuidance';

/** The details of the connection problem card (`ConnectionProblemCard`): what to do, and what `cm` answered. */
export function ConnectionProblemDialog({ problem, onClose }: { problem: ConnectionProblem; onClose: () => void }) {
  const { title, explanation } = connectionProblemWords(problem);
  const signIn = problem.kind === 'notSignedIn';

  return (
    <Dialog
      title={title}
      description={explanation}
      width={560}
      onClose={onClose}
      footer={
        <>
          {signIn && (
            <Button variant="ghost" icon={<Download size={14} />} onClick={() => void api.system.openExternal(DOWNLOAD_URL)}>
              Get the Unity Version Control app
            </Button>
          )}
          <Button variant="primary" onClick={onClose} autoFocus>
            Close
          </Button>
        </>
      }
    >
      <OutputBlock output={`$ ${problem.commandLine}\n${problem.output}`} />
    </Dialog>
  );
}
