import type { ClipboardEvent } from 'react';
import { copiedText } from './copiedText';

/**
 * Copying from a comment as shown (`copiedText`): the whole comment gives back its `source` exactly as written; a part
 * gives back what was written where it shows something else, a chip its spec (`cs:4207`), a person their `@name`, an
 * emoji its `:name:`, an image its Markdown, and the rest as it reads, its lines kept. A part holding none of those is
 * left to the browser.
 */
export function copyAsSource(source?: string): (event: ClipboardEvent<HTMLElement>) => void {
  return (event) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const fragment = selection.getRangeAt(0).cloneContents();
    const withSources = fragment.querySelector('[data-source]') ? readWithSources(fragment) : null;
    // A copy bubbles from the innermost comment out: one that set it calls `preventDefault`.
    const copiedInside = event.defaultPrevented;
    const text = copiedText({ selected: selection.toString(), shown: event.currentTarget.innerText, source, withSources, copiedInside });
    if (text === null) return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
  };
}

function readWithSources(fragment: DocumentFragment): string {
  const holder = document.createElement('div');
  holder.append(fragment);
  for (const shown of holder.querySelectorAll('[data-source]')) shown.replaceWith(shown.getAttribute('data-source') ?? '');
  // `innerText` lays the copy out to read its line breaks, so it is measured off screen for that moment.
  holder.style.cssText = 'position: fixed; left: -10000px; top: 0; white-space: normal;';
  document.body.append(holder);
  const text = holder.innerText;
  holder.remove();
  return text;
}
