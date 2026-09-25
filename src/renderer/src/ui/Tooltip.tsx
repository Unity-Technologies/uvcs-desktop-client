import { cloneElement, type ReactElement } from 'react';

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: ReactElement<Record<string, unknown>>;
}

/** Gives its child a hover tooltip, rendered by the app-wide `TooltipLayer`. The child must pass `data-*` props through to the DOM. */
export function Tooltip({ content, shortcut, children }: TooltipProps) {
  return cloneElement(children, { 'data-tip': content, 'data-tip-shortcut': shortcut });
}
