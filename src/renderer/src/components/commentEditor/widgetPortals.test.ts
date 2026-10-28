import { describe, expect, it, vi } from 'vitest';
import { WidgetPortals } from './widgetPortals';

/** An element CodeMirror gives a widget: only its identity counts here. */
const host = (): HTMLElement => ({}) as HTMLElement;

describe('WidgetPortals', () => {
  it('tells its listeners of widgets come and gone after the work that made them, once, never in the middle of it', async () => {
    // CodeMirror draws widgets inside whatever asked it to measure, a component's render among them (`coordsAtPos`):
    // telling React then updated an editor while another one rendered.
    const portals = new WidgetPortals();
    const changed = vi.fn();
    portals.subscribe(changed);
    const first = host();
    portals.show(first, 'chip');
    portals.show(host(), 'chip');
    portals.remove(first);
    expect(changed).not.toHaveBeenCalled();
    expect(portals.portals()).toHaveLength(0);
    await Promise.resolve();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(portals.portals()).toHaveLength(1);
  });

  it('keeps the same list while no widget comes or goes: what lets `WidgetPortalsView` skip a key’s render', async () => {
    // A key re-renders the editor; the chips' view, memoized, re-renders only when this list is a new one.
    const portals = new WidgetPortals();
    portals.show(host(), 'chip');
    await Promise.resolve();
    const drawn = portals.portals();
    portals.remove(host());
    await Promise.resolve();
    expect(portals.portals()).toBe(drawn);
  });
});
