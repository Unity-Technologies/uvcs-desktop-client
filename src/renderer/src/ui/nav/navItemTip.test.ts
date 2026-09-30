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

    it('keeps the whole label, which shows whole', () => {
      expect(navItemTip({ label: 'Collapse sidebar', railLabel: 'Collapse', shortcut: 'mod+backslash' }, false)).toBe('Collapse sidebar');
    });
  });

  describe('in the rail, where each tile shows its label', () => {
    it('says nothing for a tile that shows all there is', () => {
      expect(navItemTip({ label: 'Settings' }, true)).toBeUndefined();
      expect(navItemTip({ label: 'This computer' }, true)).toBeUndefined();
    });

    it('names the entry to carry its shortcut or the words of its dot', () => {
      expect(navItemTip({ label: 'Branch Explorer', shortcut: 'mod+4' }, true)).toBe('Branch Explorer');
      expect(navItemTip({ label: 'Changes', dot: 'Changes left on /main/task' }, true)).toBe('Changes');
    });

    it('adds the count and the detail the tile leaves out', () => {
      expect(navItemTip({ label: 'Changes', badge: 1234, shortcut: 'mod+1' }, true)).toBe('Changes · 1234');
      expect(navItemTip({ label: 'acme', detail: 'Cloud' }, true)).toBe('acme · Cloud');
    });

    it('spells out a label the tile shortens', () => {
      expect(navItemTip({ label: 'Expand sidebar', railLabel: 'Expand' }, true)).toBe('Expand sidebar');
    });

    it('treats a count of zero as none', () => {
      expect(navItemTip({ label: 'Incoming', badge: 0 }, true)).toBeUndefined();
    });
  });
});
