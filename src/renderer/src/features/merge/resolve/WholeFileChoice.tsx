import { Check, File, ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { FileContent } from '@shared/domain/content';
import { PathLabel } from '../../../components/PathLabel';
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
}

/** For files that can't be merged line by line (binaries): pick the version to keep. */
export function WholeFileChoice({ contents, labels, chosen, onChoose }: WholeFileChoiceProps) {
  return (
    <div className={styles.choices}>
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
  // An image the browser can't decode (a damaged file, a format it doesn't read) shows as what it is, not a broken image.
  const [undecodableUrl, setUndecodableUrl] = useState<string>();
  const undecodable = undecodableUrl !== undefined && undecodableUrl === content.imageDataUrl;
  return (
    <button className={styles.card} data-selected={selected} onClick={onSelect}>
      <div className={styles.preview}>
        {content.imageDataUrl && !undecodable ? (
          <img src={content.imageDataUrl} alt={title} className={styles.image} onError={() => setUndecodableUrl(content.imageDataUrl)} />
        ) : (
          <span className={styles.noPreview} data-tip={content.imageDataUrl ? "Couldn't display this image" : undefined}>
            {content.imageDataUrl ? <ImageOff size={28} /> : <File size={28} />}
          </span>
        )}
      </div>
      <div className={styles.caption}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>
          <PathLabel path={subtitle} />
          <span className={styles.sizeNote}>{formatSize(content.size)}</span>
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
