import { hotkey } from '../../lib/shortcutRegistry';
import type { KeyHint } from '../../ui/KeyHints';
import { SUGGESTION_TRIGGERS, type SuggestionKind } from './suggestionTriggers';

/** A hint of focus mode's footer (`KeyHints`): keys pressed (`typed` false) or text typed as written, and what it does. */
export interface FocusModeHint extends KeyHint {
  keys: readonly string[];
  typed: boolean;
}

/** What each suggestion's trigger writes, in the palette's way of naming its prefixes: one short lowercase word. */
const TRIGGER_WORDS: Record<SuggestionKind, string> = {
  changeset: 'reference',
  branch: 'reference',
  label: 'reference',
  shelve: 'reference',
  codeReview: 'reference',
  person: 'mention',
  emoji: 'emoji',
};

/**
 * Focus mode's footer: the triggers the suggestions take (`SUGGESTION_TRIGGERS`), grouped by what they write, then
 * the key for a link. Read from the triggers themselves, it names whatever the editor reads.
 */
export function focusModeHints(): FocusModeHint[] {
  const hints: FocusModeHint[] = [];
  for (const [trigger, kind] of Object.entries(SUGGESTION_TRIGGERS)) {
    const label = TRIGGER_WORDS[kind];
    const hint = hints.find((written) => written.label === label);
    if (hint) hints[hints.indexOf(hint)] = { ...hint, keys: [...hint.keys, trigger] };
    else hints.push({ keys: [trigger], typed: true, label });
  }
  hints.push({ keys: [hotkey('commentLink')], typed: false, label: 'link' });
  return hints;
}
