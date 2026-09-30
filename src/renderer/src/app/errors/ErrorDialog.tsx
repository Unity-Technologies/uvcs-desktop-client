import { useQuery } from '@tanstack/react-query';
import { Bug, Check, Copy, TerminalSquare } from 'lucide-react';
import type { FailedCommand } from '@shared/ipc';
import { api } from '../../api/client';
import { withControlPictures } from '../../lib/controlPictures';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { OutputBlock } from '../../ui/OutputBlock';
import { PropertyList } from '../../ui/PropertyList';
import { appInfoQuery } from '../about/appInfoQuery';
import { commandEnding } from '../shell/commandEnding';
import { cmVersionQuery } from '../startup/useCmAvailability';
import { useCopiedFeedback } from '../useCopiedFeedback';
import styles from './ErrorDialog.module.css';
import { errorIssueUrl } from './errorIssueUrl';
import { errorReport } from './errorReport';

interface ErrorDialogProps {
  /** What failed, in plain words, e.g. "Checkin failed". */
  title: string;
  message: string;
  command: FailedCommand;
  /** Opens the command log on this command; absent where the log isn't shown. */
  onShowInLog?: () => void;
  onClose: () => void;
}

/** Everything `cm` said about a failure: enough to understand it, search for it or report it. */
export function ErrorDialog({ title, message, command, onShowInLog, onClose }: ErrorDialogProps) {
  const { copied, copy } = useCopiedFeedback();
  const { data: info } = useQuery(appInfoQuery);
  const { data: cmVersion } = useQuery(cmVersionQuery);

  return (
    <Dialog
      title={title}
      description={<span className="selectable">{message}</span>}
      width={620}
      onClose={onClose}
      footer={
        <>
          <div className={styles.secondaryActions}>
            {onShowInLog && (
              <Button
                variant="ghost"
                icon={<TerminalSquare size={14} />}
                onClick={() => {
                  onShowInLog();
                  onClose();
                }}
              >
                Show in command log
              </Button>
            )}
            {info && (
              <Button
                variant="ghost"
                icon={<Bug size={14} />}
                title="A bug report on GitHub with this error and the app's details filled in, to review before sending"
                onClick={() => void api.system.openExternal(errorIssueUrl(info, cmVersion, { title, message, command }))}
              >
                Report an Issue
              </Button>
            )}
          </div>
          <Button icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => copy(errorReport(title, message, command))}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="primary" onClick={onClose} autoFocus>
            Close
          </Button>
        </>
      }
    >
      <PropertyList
        properties={[
          { label: 'Command', value: withControlPictures(command.commandLine), mono: true, copyText: command.commandLine },
          { label: 'Result', value: commandEnding(command.exitCode) },
        ]}
      />
      <OutputBlock output={command.output} />
    </Dialog>
  );
}
