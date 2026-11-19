import { describe, expect, it } from 'vitest';
import { windowChrome } from '@shared/windowChrome';
import { captionButtons, titleBarOptions, topBarHeightAt, trafficLightsAt } from './titleBar';

describe('titleBarOptions', () => {
  it('insets the traffic lights on macOS', () => {
    expect(titleBarOptions(windowChrome('darwin'), false)).toMatchObject({ titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 20 } });
  });

  it('overlays the caption buttons on the top bar on Windows, as tall as it', () => {
    const options = titleBarOptions(windowChrome('win32'), true);
    expect(options).toMatchObject({ titleBarStyle: 'hidden', titleBarOverlay: { height: 52 } });
    expect(options).not.toHaveProperty('trafficLightPosition');
  });

  it('keeps the desktop’s own frame on Linux', () => {
    expect(titleBarOptions(windowChrome('linux'), false)).toEqual({ titleBarStyle: 'default' });
  });
});

describe('trafficLightsAt', () => {
  it('centers them in the top bar at 100%', () => {
    expect(trafficLightsAt(1)).toEqual({ x: 16, y: 20 });
  });

  it('keeps them centered in the top bar as the zoom shrinks or grows it, as far in from the left', () => {
    // The bar is 52 × zoom points tall; the lights' top sits 6 above its middle at every zoom.
    expect(trafficLightsAt(0.9)).toEqual({ x: 16, y: 17 });
    expect(trafficLightsAt(2 / 3)).toEqual({ x: 16, y: 11 });
    expect(trafficLightsAt(1.5)).toEqual({ x: 16, y: 33 });
    expect(trafficLightsAt(3)).toEqual({ x: 16, y: 72 });
  });

  it('never puts them above the window at the smallest zoom', () => {
    expect(trafficLightsAt(0.2)).toEqual({ x: 16, y: 0 });
  });
});

describe('topBarHeightAt', () => {
  it('scales the top bar’s 52 pixels by the zoom, in whole points', () => {
    expect(topBarHeightAt(1)).toBe(52);
    expect(topBarHeightAt(0.9)).toBe(47);
    expect(topBarHeightAt(1.2 ** 0.5)).toBe(57);
    expect(topBarHeightAt(1.5)).toBe(78);
  });
});

describe('captionButtons', () => {
  it('draws the symbols in the theme’s text color over a clear background', () => {
    expect(captionButtons(false, 1)).toMatchObject({ color: '#00000000', symbolColor: '#1f2328' });
    expect(captionButtons(true, 1)).toMatchObject({ color: '#00000000', symbolColor: '#e6edf3' });
  });

  it('makes them as tall as the top bar at the page’s zoom', () => {
    expect(captionButtons(false, 1).height).toBe(52);
    expect(captionButtons(true, 0.9).height).toBe(47);
    expect(captionButtons(false, 1.5).height).toBe(78);
  });
});
