import { describe, expect, it } from 'vitest';
import { showsFocusRing } from '../../lib/focusRing';
import { mainFocusMover } from './mainFocusMover';

describe('mainFocusMover', () => {
  it('gives the first list focus without a ring when the workspace opens: no one moved it, so its selected row shows no keyboard ring', () => {
    expect(showsFocusRing(mainFocusMover('workspaceOpened'))).toBe(false);
  });

  it('leaves the ring to how the user navigated (⌘1… rings, a sidebar click does not)', () => {
    expect(mainFocusMover('navigated')).toBe('keyboard');
  });
});
