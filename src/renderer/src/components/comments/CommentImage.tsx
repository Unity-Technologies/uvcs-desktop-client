import * as RadixPopover from '@radix-ui/react-popover';
import { Image as ImageIcon } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { api } from '../../api/client';
import styles from './CommentImage.module.css';

/** How long the pointer rests on an image's chip before its picture is fetched and shown. */
const HOVER_DELAY_MS = 350;

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
  const [open, setOpen] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const openInBrowser = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    void api.system.openExternal(url);
  };
  const show = (): void => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };
  const hide = (): void => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <RadixPopover.Root open={open}>
      <RadixPopover.Anchor asChild>
        <a href={url} className={styles.chip} data-source={source} onClick={openInBrowser} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
          <ImageIcon size={13} strokeWidth={2.25} aria-hidden className={styles.icon} />
          <span className={styles.alt}>{alt || 'Image'}</span>
        </a>
      </RadixPopover.Anchor>
      <RadixPopover.Portal>
        <RadixPopover.Content className={styles.preview} side="bottom" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(event) => event.preventDefault()}>
          <img src={url} alt={alt} referrerPolicy="no-referrer" />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
