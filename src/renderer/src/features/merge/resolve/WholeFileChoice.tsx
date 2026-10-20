import { Check, File, ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { FileContent, ImageBytes } from '@shared/domain/content';
import { currentExternalApps } from '../../../components/externalApps/externalApps';
import { PathLabel } from '../../../components/PathLabel';
import { undecodedTip } from '../../diff/viewer/image/imageInfo';
import { useImageUrl } from '../../diff/viewer/image/useImageUrl';
import { usePaintableImage } from '../../diff/viewer/image/usePaintableImage';
import { formatSize } from '../../../lib/formatDate';
import { ActionContextMenu } from '../../../ui/menu/ActionContextMenu';
import { Spinner } from '../../../ui/Spinner';
import { versionAppEntries, type OpenableVersion } from './conflictVersionOpening';
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
  /** Where the base is (`ConflictedFile.baseName`). */
  baseName: string | undefined;
  /** The file has a common ancestor to keep (not one added on both sides). */
  withBase: boolean;
  /** The versions that open in other apps: a card's menu opens its own. */
  versions: OpenableVersion[];
  chosen: KeptVersion | undefined;
  onChoose: (version: KeptVersion) => void;
}

/**
 * For files that can't be merged line by line (binaries): pick the version to keep, each side's or the base's, its
 * preview showing once read.
 */
export function WholeFileChoice({ contents, error, labels, baseName, withBase, versions, chosen, onChoose }: WholeFileChoiceProps) {
  const openableOf = (version: KeptVersion) => versions.find((openable) => openable.version === version);
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
          openable={openableOf('destination')}
          onSelect={() => onChoose('destination')}
        />
        <VersionCard
          title={`Keep ${labels.roles.source.name.toLowerCase()}`}
          subtitle={labels.source}
          content={contents?.source}
          base={contents?.base}
          error={error}
          selected={chosen === 'source'}
          openable={openableOf('source')}
          onSelect={() => onChoose('source')}
        />
        {withBase && (
          <VersionCard
            title="Keep base"
            subtitle={baseName ?? 'the common ancestor'}
            content={contents?.base}
            base={undefined}
            error={error}
            selected={chosen === 'base'}
            openable={openableOf('base')}
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
  /** Its version, to open in another app from the card's menu; none when it can't be opened. */
  openable: OpenableVersion | undefined;
  onSelect: () => void;
}

/** A version to keep; its menu (right-click, or the keyboard's menu key) lists the apps to open it in. */
function VersionCard({ title, subtitle, content, base, error, selected, openable, onSelect }: VersionCardProps) {
  // Unity's texture formats decode first (`usePaintableImage`); an image that can't be painted (a damaged file, a PSD
  // saved without its composite) shows as what it is, its tooltip saying why, not as a broken image.
  const [undecodableImage, setUndecodableImage] = useState<ImageBytes>();
  const paint = usePaintableImage(content?.image);
  const undecodable = paint.status === 'failed' || (undecodableImage !== undefined && undecodableImage === content?.image);
  const imageUrl = useImageUrl(paint.status === 'paintable' ? paint.blob : undefined);
  const card = (
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
          paint.status === 'decoding' ? (
            <Spinner size={20} />
          ) : (
            imageUrl && <img src={imageUrl} alt={title} className={styles.image} onError={() => setUndecodableImage(content.image)} />
          )
        ) : (
          <span className={styles.noPreview} data-tip={content.image ? undecodedTip(paint.status === 'failed' ? paint.problem : undefined) : undefined}>
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
  if (!openable) return card;
  return <ActionContextMenu entries={() => versionAppEntries(openable.open, currentExternalApps())}>{card}</ActionContextMenu>;
}
