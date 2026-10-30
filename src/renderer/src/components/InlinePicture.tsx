import { useState, type MouseEvent } from 'react';
import { api } from '../api/client';
import { CommentImage } from './comments/CommentImage';
import { inlinePictureView, pictureLoadAfter, type PictureLoad } from './inlinePictureView';
import styles from './InlinePicture.module.css';

interface InlinePictureProps {
  url: string;
  alt: string;
  /** What copying the chip it falls back to gives back. */
  source: string;
}

/**
 * A picture shown in the text (`MarkdownImages` `inline`): as wide as the text at most, never wider than it is, at its
 * own proportions, without telling its host which page asked (`no-referrer`). A click opens it in the browser, at its
 * full size. While it loads it holds a quiet place; if it can't load, it's the chip comments show (`inlinePictureView`).
 */
export function InlinePicture({ url, alt, source }: InlinePictureProps) {
  const [load, setLoad] = useState<PictureLoad>('loading');
  const view = inlinePictureView(load);
  if (view === 'chip') return <CommentImage url={url} alt={alt} source={source} />;

  const openInBrowser = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    void api.system.openExternal(url);
  };

  return (
    <a href={url} className={styles.frame} data-loading={view === 'placeholder' || undefined} data-tip={alt || undefined} onClick={openInBrowser}>
      <img
        className={styles.picture}
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={(event) => setLoad(pictureLoadAfter('load', event.currentTarget.naturalWidth))}
        onError={() => setLoad(pictureLoadAfter('error', 0))}
      />
    </a>
  );
}
