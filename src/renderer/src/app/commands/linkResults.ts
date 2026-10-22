import { Link } from 'lucide-react';
import { linkInText } from '@shared/links/linkInText';
import { linkDescription } from '../links/linkDescription';
import { openLink } from '../links/openLink';
import type { SearchGroup } from './searchResults';

/**
 * A link pasted in the palette (docs/features/deep-links.md: a `uvcs://` or `plastic://` link, the web page around
 * one, a spec naming its repository): one row opening it, in place of the search, which would find nothing in it.
 */
export function linkGroupIn(query: string): SearchGroup | null {
  const link = linkInText(query);
  if (!link) return null;
  const { label, detail } = linkDescription(link);
  return { section: 'commands', heading: 'Link', results: [{ id: 'link.open', icon: Link, label, detail, run: () => void openLink(link) }] };
}
