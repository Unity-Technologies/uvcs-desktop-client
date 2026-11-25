import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { startingZoomQuery } from '@shared/startingZoom';
import { exposePageZoom } from './exposePageZoom';

/** A style that remembers the last `--window-zoom` it was given. */
function zoomStyle() {
  const values = new Map<string, string>();
  return { setProperty: (name: string, value: string | null) => void values.set(name, value ?? ''), zoom: () => values.get('--window-zoom') };
}

describe('exposePageZoom', () => {
  it('sets the zoom the window names in the page address before anything else, for its first frame', () => {
    const style = zoomStyle();

    exposePageZoom(`?${new URLSearchParams(startingZoomQuery(1.2 ** -2))}`, style);

    expect(style.zoom()).toBe(String(1.2 ** -2));
  });

  it('follows each change of the zoom', () => {
    const style = zoomStyle();
    exposePageZoom('', style);

    fakeApi.emit('pageZoomChanged', { zoom: 1.5 });

    expect(style.zoom()).toBe('1.5');
  });
});
