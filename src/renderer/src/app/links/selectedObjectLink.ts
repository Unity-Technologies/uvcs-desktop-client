import { useEffect } from 'react';
import { create } from 'zustand';
import type { CopyTexts } from '../../components/copyMenu';

type LinkText = Exclude<CopyTexts['link'], false | null | undefined>;

/** The link to the one object selected in the view in front (`useCopyCommand`), for "Copy link" (`useCopyLinkCommand`). */
export const useSelectedObjectLink = create<{ link: LinkText | null }>(() => ({ link: null }));

/** Offers the link of a view's selected object while the view shows it; none when it has none selected. */
export function useOfferSelectedObjectLink(link: LinkText | false | null | undefined): void {
  useEffect(() => {
    useSelectedObjectLink.setState({ link: link || null });
    return () => useSelectedObjectLink.setState({ link: null });
  }, [link]);
}
