import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { hotkey } from '../../lib/shortcutRegistry';
import { focusModeHints } from './focusModeHints';
import { SUGGESTION_TRIGGERS } from './suggestionTriggers';

describe('focusModeHints', () => {
  it('names what the triggers write, then the key for a link, as the palette names its prefixes', () => {
    expect(focusModeHints()).toEqual([
      { keys: ['cs:', 'br:', 'lb:', 'sh:', 'cr:'], typed: true, label: 'reference' },
      { keys: ['@'], typed: true, label: 'mention' },
      { keys: [':'], typed: true, label: 'emoji' },
      { keys: [hotkey('commentLink')], typed: false, label: 'link' },
    ]);
  });

  it('names every trigger the suggestions take, so the hints follow what the editor reads', () => {
    const typed = focusModeHints().flatMap((hint) => (hint.typed ? hint.keys : []));
    expect([...typed].sort()).toEqual(Object.keys(SUGGESTION_TRIGGERS).sort());
  });
});
