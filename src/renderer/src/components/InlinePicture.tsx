import { useRef, useState, type MouseEvent } from 'react';
import { CommentImage } from './comments/CommentImage';
import { inlinePictureView, pictureLabel, pictureLoadAfter, type PictureLoad } from './inlinePictureView';
import { openPictureViewer } from './PictureViewer';
import { usePictureEnlarges } from './usePictureEnlarges';
import styles from './InlinePicture.module.css';

interface InlinePictureProps {
  url: string;
  alt: string;
  /** What copying the chip it falls back to gives back. */
  source: string;
}

/**
 * A picture shown in the text (`MarkdownImages` `inline`): as wide as the text at most and no taller than a
 * screenshot should stand in it, never larger than it is, at its own proportions, without telling its host which page
 * asked (`no-referrer`). A click shows it larger (`PictureViewer`) when it shows smaller than it is
 * (`pictureEnlarges`). While it loads it holds a quiet place; if it can't load, it's the chip comments show
 * (`inlinePictureView`).
 */
export function InlinePicture({ url, alt, source }: InlinePictureProps) {
  const [load, setLoad] = useState<PictureLoad>('loading');
  const pictureRef = useRef<HTMLImageElement>(null);
  const enlarges = usePictureEnlarges(pictureRef, load === 'loaded');
  const view = inlinePictureView(load);
  if (view === 'chip') return <CommentImage url={url} alt={alt} source={source} />;

  const enlarge = (event: MouseEvent): void => {
    event.stopPropagation();
    openPictureViewer(url, alt);
  };

  return (
    <button
      type="button"
      className={styles.frame}
      data-loading={view === 'placeholder' || undefined}
      data-tip={alt || undefined}
      aria-label={pictureLabel(alt, enlarges)}
      disabled={!enlarges}
      onClick={enlarge}
    >
      <img
        ref={pictureRef}
        className={styles.picture}
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={(event) => setLoad(pictureLoadAfter('load', event.currentTarget.naturalWidth))}
        onError={() => setLoad(pictureLoadAfter('error', 0))}
      />
    </button>
  );
}
