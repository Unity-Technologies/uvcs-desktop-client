import { Server } from 'lucide-react';
import { Button } from '../../ui/Button';
import type { ServerFilePolicy } from './mergeResolutions';
import type { ConflictLabels } from './resolve/threeWayMerge';
import styles from './ServerFilePolicyPanel.module.css';

interface ServerFilePolicyPanelProps {
  path: string;
  fileCount: number;
  labels: ConflictLabels;
  policy: ServerFilePolicy | undefined;
  onChoose: (policy: ServerFilePolicy) => void;
}

/**
 * A merge into a server branch has no workspace to hold merged files, and `cm` could only combine them
 * with its external merge tool, so every conflicting file keeps one side.
 */
export function ServerFilePolicyPanel({ path, fileCount, labels, policy, onChoose }: ServerFilePolicyPanelProps) {
  return (
    <div className={styles.panel}>
      <span className={styles.icon}>
        <Server size={20} />
      </span>
      <h2 className={styles.title}>
        {policy ? `Keeping ${policy === 'source' ? labels.source : labels.destination} for every conflicting file` : `${path} changed on both sides`}
      </h2>
      <p className={styles.text}>
        This merge runs on the server, where files can't be combined. Choose which version to keep for all {fileCount} conflicting{' '}
        {fileCount === 1 ? 'file' : 'files'}, or switch your workspace to {labels.destination} and merge there to combine them line by line.
      </p>
      <div className={styles.actions}>
        <Button variant={policy === 'destination' ? 'primary' : 'secondary'} onClick={() => onChoose('destination')}>
          Keep {labels.destination} for all
        </Button>
        <Button variant={policy === 'source' ? 'primary' : 'secondary'} onClick={() => onChoose('source')}>
          Keep {labels.source} for all
        </Button>
      </div>
    </div>
  );
}
