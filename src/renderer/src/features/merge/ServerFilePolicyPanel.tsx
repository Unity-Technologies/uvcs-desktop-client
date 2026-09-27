import { Server } from 'lucide-react';
import { Button } from '../../ui/Button';
import type { ServerFilePolicy } from './mergeResolutions';
import type { ConflictLabels } from './resolve/threeWayMerge';
import { serverFilePolicyText } from './serverFilePolicyText';
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
  const text = serverFilePolicyText(path, fileCount, labels, policy);
  return (
    <div className={styles.panel}>
      <span className={styles.icon}>
        <Server size={20} />
      </span>
      <h2 className={styles.title}>{text.title}</h2>
      <p className={styles.text}>{text.explanation}</p>
      <div className={styles.actions}>
        <Button variant={policy === 'destination' ? 'primary' : 'secondary'} onClick={() => onChoose('destination')}>
          {text.keep.destination}
        </Button>
        <Button variant={policy === 'source' ? 'primary' : 'secondary'} onClick={() => onChoose('source')}>
          {text.keep.source}
        </Button>
      </div>
    </div>
  );
}
