import { describe, expect, it } from 'vitest';
import { windowChrome } from '@shared/windowChrome';
import { captionButtons, titleBarOptions } from './titleBar';

describe('titleBarOptions', () => {
  it('insets the traffic lights on macOS', () => {
    expect(titleBarOptions(windowChrome('darwin'), false)).toMatchObject({ titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } });
  });

  it('overlays the caption buttons on the top bar on Windows, as tall as it', () => {
    const options = titleBarOptions(windowChrome('win32'), true);
    expect(options).toMatchObject({ titleBarStyle: 'hidden', titleBarOverlay: { height: 44 } });
    expect(options).not.toHaveProperty('trafficLightPosition');
  });

  it('keeps the desktop’s own frame on Linux', () => {
    expect(titleBarOptions(windowChrome('linux'), false)).toEqual({ titleBarStyle: 'default' });
  });
});

describe('captionButtons', () => {
  it('draws the symbols in the theme’s text color over a clear background', () => {
    expect(captionButtons(false)).toMatchObject({ color: '#00000000', symbolColor: '#1f2328' });
    expect(captionButtons(true)).toMatchObject({ color: '#00000000', symbolColor: '#e6edf3' });
  });
});
