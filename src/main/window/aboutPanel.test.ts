import { describe, expect, it } from 'vitest';
import { aboutPanelOptions } from './aboutPanel';

describe('aboutPanelOptions', () => {
  it("names the app and its version, which Linux's About dialog doesn't know otherwise", () => {
    expect(aboutPanelOptions('Unity Version Control', '0.1.0')).toEqual({ applicationName: 'Unity Version Control', applicationVersion: '0.1.0' });
  });
});
