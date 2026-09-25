import { AppWindow } from 'lucide-react';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Spinner } from '../../../ui/Spinner';
import type { OpenTool } from './resolveInMergeTool';
import styles from './MergeToolOpenBanner.module.css';

/** While a merge tool has the file open: what to do there, and a way back if the tool is lost or done. */
export function MergeToolOpenBanner({ fileName, open }: { fileName: string; open: OpenTool }) {
  return (
    <div className={styles.banner} role="status">
      <Spinner size={13} />
      <span className={styles.text}>
        Waiting for {open.toolName}: save and close <strong>{fileName}</strong> there.
      </span>
      {open.canBringToFront && (
        <Button size="small" icon={<AppWindow size={13} />} onClick={() => void api.mergeTools.bringToFront(open.sessionId)}>
          Bring to front
        </Button>
      )}
      <Button
        size="small"
        variant="ghost"
        data-tip="Takes what was saved so far"
        onClick={() => void api.mergeTools.stopWaiting(open.sessionId)}
      >
        Stop waiting
      </Button>
    </div>
  );
}
