import type { ClipboardEvent } from 'react';

/**
 * Copying from a comment as shown gives back the comment as written where it shows something else: a chip its spec
 * (`cs:4207`), a person their `@name`, an emoji its `:name:`, an image its Markdown. The rest copies as it reads, its
 * lines kept. A selection holding none of those is left to the browser.
 */
export function copyAsSource(event: ClipboardEvent<HTMLElement>): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  const fragment = selection.getRangeAt(0).cloneContents();
  if (!fragment.querySelector('[data-source]')) return;
  const holder = document.createElement('div');
  holder.append(fragment);
  for (const shown of holder.querySelectorAll('[data-source]')) shown.replaceWith(shown.getAttribute('data-source') ?? '');
  // `innerText` lays the copy out to read its line breaks, so it is measured off screen for that moment.
  holder.style.cssText = 'position: fixed; left: -10000px; top: 0; white-space: normal;';
  document.body.append(holder);
  const text = holder.innerText;
  holder.remove();
  event.clipboardData.setData('text/plain', text);
  event.preventDefault();
}
