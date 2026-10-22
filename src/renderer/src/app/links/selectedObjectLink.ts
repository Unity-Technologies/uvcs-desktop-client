import { useEffect, useRef, type RefObject } from 'react';
import { create } from 'zustand';
import type { CopyTexts } from '../../components/copyMenu';

export type LinkText = Exclude<CopyTexts['link'], false | null | undefined>;

/**
 * Where the link to the one object selected in the view in front comes from (`useCopyCommand`), for "Copy link"
 * (`useCopyLinkCommand`). A ref the view keeps current: the store changes only as a view starts or stops offering one,
 * never on each render, as a view builds its copy texts anew each time.
 */
export const useSelectedObjectLink = create<{ source: RefObject<LinkText | null> | null }>(() => ({ source: null }));

/** Offers the link of a view's selected object while the view shows it; none when it has none selected. */
export function useOfferSelectedObjectLink(link: LinkText | false | null | undefined): void {
  const source = useRef<LinkText | null>(null);
  source.current = link || null;
  const offers = Boolean(link);
  useEffect(() => {
    if (!offers) return;
    useSelectedObjectLink.setState({ source });
    return () => useSelectedObjectLink.setState((state) => (state.source === source ? { source: null } : state));
  }, [offers]);
}
