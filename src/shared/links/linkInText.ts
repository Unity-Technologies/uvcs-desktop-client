import { formatLink } from './formatLink';
import { parseLink } from './parseLink';
import { specLink } from './specLink';

/**
 * The link a pasted text holds, as people paste what they were sent: a `uvcs://` or `plastic://` link, the official
 * client's web page around one (`https://cloud.unity.com/…/desktop?url=plastic://…`), or a spec naming its repository
 * (`cs:4207@game@acme@unity`, as `formatLink` writes it). Null for any other text. A link that doesn't read stays as
 * written, so opening it says what's wrong.
 */
export function linkInText(text: string): string | null {
  const trimmed = text.trim();
  if (/^(?:uvcs|plastic):\/\//i.test(trimmed)) return trimmed;
  const wrapped = wrappedLink(trimmed);
  if (wrapped) return wrapped;
  const spec = specLink(trimmed);
  return spec ? formatLink(spec) : null;
}

/** The link in the official client's web page around one: its `url` query, encoded or not. */
function wrappedLink(text: string): string | null {
  if (!/^https:\/\//i.test(text)) return null;
  const url = /[?&]url=(.+)$/i.exec(text)?.[1];
  if (!url) return null;
  const decoded = url.includes('://') ? url : safeDecode(url);
  return decoded && /^(?:uvcs|plastic):\/\//i.test(decoded) && !('problem' in parseLink(decoded)) ? decoded : null;
}

function safeDecode(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}
