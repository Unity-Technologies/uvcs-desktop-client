import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { scopeStepOf } from './paletteScopeKeys';

const pressed = (key: string, modifiers: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => ({
  key,
  code: key,
  metaKey: modifiers.meta ?? false,
  ctrlKey: modifiers.ctrl ?? false,
  altKey: modifiers.alt ?? false,
  shiftKey: modifiers.shift ?? false,
});

describe('scopeStepOf', () => {
  it('steps with ⌥⌘→ and ⌥⌘← on macOS', () => {
    expect(scopeStepOf(pressed('ArrowRight', { meta: true, alt: true }), true)).toBe(1);
    expect(scopeStepOf(pressed('ArrowLeft', { meta: true, alt: true }), true)).toBe(-1);
  });

  it('steps with Alt+→ and Alt+← on Windows and Linux', () => {
    expect(scopeStepOf(pressed('ArrowRight', { alt: true }), false)).toBe(1);
    expect(scopeStepOf(pressed('ArrowLeft', { alt: true }), false)).toBe(-1);
  });

  it('leaves the caret its keys: ⌘ or ⌥ alone with an arrow, and arrows with Shift, which select', () => {
    expect(scopeStepOf(pressed('ArrowRight', { meta: true }), true)).toBeNull();
    expect(scopeStepOf(pressed('ArrowRight', { alt: true }), true)).toBeNull();
    expect(scopeStepOf(pressed('ArrowRight', { meta: true, alt: true, shift: true }), true)).toBeNull();
    expect(scopeStepOf(pressed('ArrowRight', { ctrl: true }), false)).toBeNull();
    expect(scopeStepOf(pressed('ArrowRight', { alt: true, shift: true }), false)).toBeNull();
  });

  it('takes no other key', () => {
    expect(scopeStepOf(pressed('ArrowRight'), true)).toBeNull();
    expect(scopeStepOf(pressed('ArrowDown', { meta: true, alt: true }), true)).toBeNull();
  });
});
