import { linkInText } from '@shared/links/linkInText';
import { prompt } from '../../ui/dialog/prompt';
import { openLink } from './openLink';

/**
 * File ▸ Open Link… and the palette's "Open link…": asks for a link, the one on the clipboard already in the field,
 * and opens it (`linkInText` takes what people paste).
 */
export async function askAndOpenLink(): Promise<void> {
  const typed = await prompt({
    title: 'Open link',
    label: 'Link',
    description: 'A uvcs:// or plastic:// link to a changeset, a branch, a review…',
    initialValue: (await clipboardLink()) ?? '',
    acceptInitialValue: true,
    confirmLabel: 'Open',
    validate: (value) => (linkInText(value) ? undefined : "This isn't a link."),
  });
  const link = typed === undefined ? null : linkInText(typed);
  if (link) await openLink(link);
}

/** The link on the clipboard, if it holds one; null when it holds something else or can't be read. */
async function clipboardLink(): Promise<string | null> {
  try {
    return linkInText(await navigator.clipboard.readText());
  } catch {
    return null;
  }
}
