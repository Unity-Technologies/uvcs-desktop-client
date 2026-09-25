import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FileContent } from '@shared/domain/content';
import { formatSize } from '../../../lib/formatDate';
import type { ConflictContents } from './useFileConflicts';
import type { MergeLabels } from '../mergeDescription';
import styles from './WholeFileChoice.module.css';

type Side = 'source' | 'destination';

interface WholeFileChoiceProps {
  contents: ConflictContents;
  labels: MergeLabels;
  chosen: Side | undefined;
  onChoose: (side: Side) => void;
  /** Comparing them in a merge tool that handles binaries (the UVCS one), when there is one. */
  toolButton?: ReactNode;
}

/** For files that can't be merged line by line (binaries): pick the version to keep. */
export function WholeFileChoice({ contents, labels, chosen, onChoose, toolButton }: WholeFileChoiceProps) {
  return (
    <div className={styles.choices}>
      <p className={styles.intro}>This file can't be merged line by line. Choose the version to keep.</p>
      {toolButton && <div className={styles.tool}>{toolButton}</div>}
      <div className={styles.options}>
        <VersionCard
          title={`Keep ${labels.roles.destination.name.toLowerCase()}`}
          subtitle={labels.destination}
          content={contents.destination}
          selected={chosen === 'destination'}
          onSelect={() => onChoose('destination')}
        />
        <VersionCard
          title={`Keep ${labels.roles.source.name.toLowerCase()}`}
          subtitle={labels.source}
          content={contents.source}
          selected={chosen === 'source'}
          onSelect={() => onChoose('source')}
        />
      </div>
    </div>
  );
}

interface VersionCardProps {
  title: string;
  subtitle: string;
  content: FileContent;
  selected: boolean;
  onSelect: () => void;
}

function VersionCard({ title, subtitle, content, selected, onSelect }: VersionCardProps) {
  return (
    <button className={styles.card} data-selected={selected} onClick={onSelect}>
      <div className={styles.preview}>
        {content.imageDataUrl ? <img src={content.imageDataUrl} alt={title} className={styles.image} /> : <span className={styles.size}>{formatSize(content.size)}</span>}
      </div>
      <div className={styles.caption}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>
          {subtitle} · {formatSize(content.size)}
        </span>
      </div>
      {selected && (
        <span className={styles.check}>
          <Check size={13} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
