import { AlertTriangle, Bug, RotateCw } from 'lucide-react';
import type { UnexpectedError } from '@shared/events';
import { Button } from '../../ui/Button';
import { OutputBlock } from '../../ui/OutputBlock';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { reportUnexpectedError } from './reportUnexpectedErrors';

/** What a window shows once an error broke what it showed (`AppErrorBoundary`): a way back, and a way to report it. */
export function WindowErrorScreen({ error }: { error: UnexpectedError }) {
  return (
    <ScreenMessage
      icon={<AlertTriangle size={26} />}
      tone="warning"
      title="This window ran into a problem"
      actions={
        <>
          <Button variant="primary" icon={<RotateCw size={14} />} onClick={() => window.location.reload()} autoFocus>
            Reload
          </Button>
          <Button icon={<Bug size={14} />} onClick={() => void reportUnexpectedError(error)}>
            Report an Issue
          </Button>
        </>
      }
      footer={<OutputBlock output={error.message} />}
    >
      <p>Reload the window to carry on. Your workspace and its files are as they were.</p>
    </ScreenMessage>
  );
}
