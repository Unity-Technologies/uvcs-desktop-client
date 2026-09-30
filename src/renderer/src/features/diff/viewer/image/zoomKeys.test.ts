import { describe, expect, it } from 'vitest';
import { zoomCommandOf } from './zoomKeys';

const press = (key: string, modifiers: Partial<Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey'>> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, ...modifiers });

describe('zoomCommandOf', () => {
  it('steps the zoom with + or = and −, fits with 0 and shows 100% with 1', () => {
    expect(['+', '=', '-', '0', '1', 'a'].map((key) => zoomCommandOf(press(key)))).toEqual(['zoomIn', 'zoomIn', 'zoomOut', 'zoomToFit', 'zoomToActualSize', null]);
  });

  it('leaves keys held with ⌘, Ctrl or Alt to the window: ⌘1 goes to the first view', () => {
    expect(zoomCommandOf(press('1', { metaKey: true }))).toBeNull();
    expect(zoomCommandOf(press('0', { ctrlKey: true }))).toBeNull();
    expect(zoomCommandOf(press('-', { altKey: true }))).toBeNull();
  });
});
