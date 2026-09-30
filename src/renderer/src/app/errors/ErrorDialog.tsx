import { Check, Copy, TerminalSquare } from 'lucide-react';
import type { FailedCommand } from '@shared/ipc';
import { withControlPictures } from '../../lib/controlPictures';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { OutputBlock } from '../../ui/OutputBlock';
import { PropertyList } from '../../ui/PropertyList';
import { commandEnding } from '../shell/commandEnding';
import { useCopiedFeedback } from '../useCopiedFeedback';
import styles from './ErrorDialog.module.css';
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

  return (
    <Dialog
      title={title}
      description={<span className="selectable">{message}</span>}
      width={620}
      onClose={onClose}
      footer={
        <>
          {onShowInLog && (
            <Button
              variant="ghost"
              className={styles.showInLog}
              icon={<TerminalSquare size={14} />}
              onClick={() => {
                onShowInLog();
                onClose();
              }}
            >
              Show in command log
            </Button>
          )}
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
