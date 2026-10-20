import { AppWindow } from 'lucide-react';
import { SMART_MERGE_NAME } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Spinner } from '../../../ui/Spinner';
import { stopMergeToolSession } from './mergeToolSessions';
import type { OpenTool } from './resolveInMergeTool';
import { runPositionText, type RunProgress } from './resolveRun';
import styles from './MergeToolOpenBanner.module.css';

interface MergeToolOpenBannerProps {
  fileName: string;
  open: OpenTool;
  /** The run the file is part of: the header skips or stops it, and the next file opens once this one is closed. */
  run: RunProgress | null;
}

/**
 * While a merge tool has the file open: what to do there, and a way back if the tool is lost or done. While Smart
 * Merge merges it there's nothing to do but wait, or stop it.
 */
export function MergeToolOpenBanner({ fileName, open, run }: MergeToolOpenBannerProps) {
  const last = run && run.position === run.total - 1;
  if (open.toolName === SMART_MERGE_NAME) {
    return (
      <div className={styles.banner} role="status">
        <Spinner size={13} />
        <span className={styles.text}>
          Merging <strong>{fileName}</strong> with Smart Merge…
        </span>
        {!run && (
          <Button size="small" variant="ghost" data-tip="Leaves the file as it was" onClick={() => void stopMergeToolSession(open.sessionId)}>
            Stop
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className={styles.banner} role="status">
      <Spinner size={13} />
      <span className={styles.text}>
        Waiting for {open.toolName}: save and close <strong>{fileName}</strong> there
        {run ? <span className={styles.next}>{` · file ${runPositionText(run)}${last ? '' : ', then the next opens'}`}</span> : '.'}
      </span>
      {open.canBringToFront && (
        <Button size="small" icon={<AppWindow size={13} />} onClick={() => void api.mergeTools.bringToFront(open.sessionId)}>
          Bring to front
        </Button>
      )}
      {!run && (
        <Button size="small" variant="ghost" data-tip="Takes what was saved so far" onClick={() => void stopMergeToolSession(open.sessionId)}>
          Stop waiting
        </Button>
      )}
    </div>
  );
}
