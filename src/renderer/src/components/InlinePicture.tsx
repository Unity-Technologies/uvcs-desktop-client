import { useState, type MouseEvent, type SyntheticEvent } from 'react';
import { CommentImage } from './comments/CommentImage';
import { inlinePictureView, pictureEnlarges, pictureLoadAfter, type PictureLoad } from './inlinePictureView';
import { openPictureViewer } from './PictureViewer';
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
  const [enlarges, setEnlarges] = useState(false);
  const view = inlinePictureView(load);
  if (view === 'chip') return <CommentImage url={url} alt={alt} source={source} />;

  const loaded = (event: SyntheticEvent<HTMLImageElement>): void => {
    const picture = event.currentTarget;
    setLoad(pictureLoadAfter('load', picture.naturalWidth));
    setEnlarges(pictureEnlarges(picture.naturalWidth, picture.clientWidth));
  };
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
      aria-label={alt ? `Enlarge ${alt}` : 'Enlarge picture'}
      disabled={!enlarges}
      onClick={enlarge}
    >
      <img className={styles.picture} src={url} alt={alt} referrerPolicy="no-referrer" onLoad={loaded} onError={() => setLoad(pictureLoadAfter('error', 0))} />
    </button>
  );
}
