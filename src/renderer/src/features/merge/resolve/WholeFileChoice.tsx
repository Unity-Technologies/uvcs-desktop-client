import { Check, File, ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { FileContent, ImageBytes } from '@shared/domain/content';
import { PathLabel } from '../../../components/PathLabel';
import { useImageUrl } from '../../diff/viewer/image/useImageUrl';
import { formatSize } from '../../../lib/formatDate';
import { Spinner } from '../../../ui/Spinner';
import type { KeptVersion } from './fileConflictDecision';
import type { ConflictContents } from './loadedConflict';
import type { MergeLabels } from '../mergeDescription';
import { ModelSinceBase, ModelVersionThumbnail } from './ModelVersionPreview';
import styles from './WholeFileChoice.module.css';

interface WholeFileChoiceProps {
  /** Its versions, once read: the cards can be picked before (a known binary is decided without its bytes). */
  contents: ConflictContents | undefined;
  /** Why the versions couldn't be read. */
  error: Error | undefined;
  labels: MergeLabels;
  /** The file has a common ancestor to keep (not one added on both sides). */
  withBase: boolean;
  chosen: KeptVersion | undefined;
  onChoose: (version: KeptVersion) => void;
}

/**
 * For files that can't be merged line by line (binaries): pick the version to keep, each side's or the base's, its
 * preview showing once read.
 */
export function WholeFileChoice({ contents, error, labels, withBase, chosen, onChoose }: WholeFileChoiceProps) {
  return (
    <div className={styles.choices}>
      <div className={styles.options}>
        <VersionCard
          title={`Keep ${labels.roles.destination.name.toLowerCase()}`}
          subtitle={labels.destination}
          content={contents?.destination}
          base={contents?.base}
          error={error}
          selected={chosen === 'destination'}
          onSelect={() => onChoose('destination')}
        />
        <VersionCard
          title={`Keep ${labels.roles.source.name.toLowerCase()}`}
          subtitle={labels.source}
          content={contents?.source}
          base={contents?.base}
          error={error}
          selected={chosen === 'source'}
          onSelect={() => onChoose('source')}
        />
        {withBase && (
          <VersionCard
            title="Keep base"
            subtitle="Common ancestor"
            content={contents?.base}
            base={undefined}
            error={error}
            selected={chosen === 'base'}
            onSelect={() => onChoose('base')}
          />
        )}
      </div>
    </div>
  );
}

interface VersionCardProps {
  title: string;
  subtitle: string;
  /** The version, once read. */
  content: FileContent | undefined;
  /** The common ancestor: a model's card tells what its side changed since. */
  base: FileContent | undefined;
  error: Error | undefined;
  selected: boolean;
  onSelect: () => void;
}

function VersionCard({ title, subtitle, content, base, error, selected, onSelect }: VersionCardProps) {
  // An image the browser can't decode (a damaged file, a format it doesn't read) shows as what it is, not a broken image.
  const [undecodableImage, setUndecodableImage] = useState<ImageBytes>();
  const undecodable = undecodableImage !== undefined && undecodableImage === content?.image;
  const imageUrl = useImageUrl(content?.image);
  return (
    <button className={styles.card} data-selected={selected} onClick={onSelect}>
      <div className={styles.preview}>
        {!content ? (
          error ? (
            <span className={styles.noPreview} data-tip={`Couldn't read this version: ${error.message}`}>
              <File size={28} />
            </span>
          ) : (
            <Spinner size={20} />
          )
        ) : content.model ? (
          <ModelVersionThumbnail content={content} title={title} />
        ) : content.image && !undecodable ? (
          imageUrl && <img src={imageUrl} alt={title} className={styles.image} onError={() => setUndecodableImage(content.image)} />
        ) : (
          <span className={styles.noPreview} data-tip={content.image ? "Couldn't display this image" : undefined}>
            {content.image ? <ImageOff size={28} /> : <File size={28} />}
          </span>
        )}
      </div>
      <div className={styles.caption}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>
          <PathLabel path={subtitle} />
          {content && <span className={styles.sizeNote}>{formatSize(content.size)}</span>}
        </span>
      </div>
      {content?.model && base && <ModelSinceBase base={base} content={content} />}
      {selected && (
        <span className={styles.check}>
          <Check size={13} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
