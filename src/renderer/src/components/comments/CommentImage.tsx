import { Image as ImageIcon } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';
import { api } from '../../api/client';
import { AnchoredCard, useHoverOpen } from './AnchoredCard';
import styles from './CommentImage.module.css';

interface CommentImageProps {
  url: string;
  alt: string;
  /** What copying gives back. */
  source: string;
}

/**
 * An image a comment links to, as a chip with its description: its picture shows on hover, fetched from its host
 * only then, never as the comment renders, and without telling the host which page asked (`no-referrer`). A click
 * opens it in the browser.
 */
export function CommentImage({ url, alt, source }: CommentImageProps) {
  const anchor = useRef<HTMLAnchorElement>(null);
  const { open, handlers } = useHoverOpen();
  const openInBrowser = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    void api.system.openExternal(url);
  };

  return (
    <>
      <a ref={anchor} href={url} className={styles.chip} data-source={source} onClick={openInBrowser} {...handlers}>
        <ImageIcon size={13} strokeWidth={2.25} aria-hidden className={styles.icon} />
        <span className={styles.alt}>{alt || 'Image'}</span>
      </a>
      {/* By the chip, as the app's tooltips are: no layer that would take Esc from a dialog around it. */}
      {open && (
        <AnchoredCard anchor={anchor}>
          <div className={styles.preview}>
            <img src={url} alt={alt} referrerPolicy="no-referrer" />
          </div>
        </AnchoredCard>
      )}
    </>
  );
}
