import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { focusModeHints } from './focusModeHints';
import { SUGGESTION_TRIGGERS } from './suggestionTriggers';

describe('focusModeHints', () => {
  it('names what the triggers write, as the palette names its prefixes, most used first; the link key is its button’s tooltip', () => {
    expect(focusModeHints()).toEqual([
      { keys: ['cs:', 'br:', 'lb:', 'sh:', 'cr:'], typed: true, label: 'reference' },
      { keys: ['@'], typed: true, label: 'mention' },
      { keys: [':'], typed: true, label: 'emoji' },
    ]);
  });

  it('names every trigger the suggestions take, so the hints follow what the editor reads', () => {
    const typed = focusModeHints().flatMap((hint) => (hint.typed ? hint.keys : []));
    expect([...typed].sort()).toEqual(Object.keys(SUGGESTION_TRIGGERS).sort());
  });
});
