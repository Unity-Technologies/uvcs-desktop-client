import { Download } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { OutputBlock } from '../../ui/OutputBlock';
import { DOWNLOAD_URL } from './installGuidance';

interface ConnectionProblemDialogProps {
  title: string;
  explanation: string;
  /** The command that found the problem and what `cm` answered. */
  details: { commandLine: string; output: string };
  /** Offers the Unity Version Control app, where a sign-in is made until this app signs in itself. */
  offersSignInApp?: boolean;
  onClose: () => void;
}

/**
 * The details of a server's problem (`ConnectionProblemCard`'s server out of reach, `SignInScreen`'s sign-in): what to
 * do, and what `cm` answered.
 */
export function ConnectionProblemDialog({ title, explanation, details, offersSignInApp = false, onClose }: ConnectionProblemDialogProps) {
  return (
    <Dialog
      title={title}
      description={explanation}
      width={560}
      onClose={onClose}
      footer={
        <>
          {offersSignInApp && (
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
      <OutputBlock output={`$ ${details.commandLine}\n${details.output}`} />
    </Dialog>
  );
}
