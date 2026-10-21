import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { exposePageZoom } from './exposePageZoom';

/** A style that remembers the last `--window-zoom` it was given. */
function zoomStyle() {
  const values = new Map<string, string>();
  return { setProperty: (name: string, value: string | null) => void values.set(name, value ?? ''), zoom: () => values.get('--window-zoom') };
}

afterEach(() => Object.assign(window.uvcs, { initialZoom: 1 }));

describe('exposePageZoom', () => {
  it('sets the zoom the page starts at before anything else, for its first frame', () => {
    Object.assign(window.uvcs, { initialZoom: 1.2 ** -2 });
    const style = zoomStyle();

    exposePageZoom(style);

    expect(style.zoom()).toBe(String(1.2 ** -2));
  });

  it('follows each change of the zoom', () => {
    const style = zoomStyle();
    exposePageZoom(style);

    fakeApi.emit('pageZoomChanged', { zoom: 1.5 });

    expect(style.zoom()).toBe('1.5');
  });
});
