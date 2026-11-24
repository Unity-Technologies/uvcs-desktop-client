import { useState } from 'react';

/** How long a copy button says "Copied" before it offers to copy again. */
const COPIED_FEEDBACK_MS = 1500;

/** Copies `text` and says so for a moment: `copied` is true until the feedback ends. */
export function useCopiedFeedback(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };
  return { copied, copy };
}
