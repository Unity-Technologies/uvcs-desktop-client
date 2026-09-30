import { describe, expect, it } from 'vitest';
import { navItemTip } from './navItemTip';

describe('navItemTip', () => {
  describe('wide', () => {
    it('says nothing an entry already shows', () => {
      expect(navItemTip({ label: 'Settings' }, false)).toBeUndefined();
      expect(navItemTip({ label: 'Changes', badge: 12 }, false)).toBeUndefined();
      expect(navItemTip({ label: 'acme', detail: 'Cloud' }, false)).toBeUndefined();
    });

    it('names the entry to carry its shortcut or the words of its dot', () => {
      expect(navItemTip({ label: 'Branches', shortcut: 'mod+5' }, false)).toBe('Branches');
      expect(navItemTip({ label: 'Changes', dot: 'Changes left on /main/task' }, false)).toBe('Changes');
    });
  });

  describe('in the rail of icons', () => {
    it('names every entry, with its detail and count', () => {
      expect(navItemTip({ label: 'Settings' }, true)).toBe('Settings');
      expect(navItemTip({ label: 'acme', detail: 'Cloud' }, true)).toBe('acme · Cloud');
      expect(navItemTip({ label: 'Changes', badge: 1234, shortcut: 'mod+1' }, true)).toBe('Changes · 1234');
    });
  });
});
