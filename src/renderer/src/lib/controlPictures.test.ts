import { describe, expect, it } from 'vitest';
import { withControlPictures } from './controlPictures';

describe('withControlPictures', () => {
  it('shows the field and record separators of a --format as their pictures', () => {
    expect(withControlPictures('--format={id}\u001f{name}\u001e')).toBe('--format={id}␟{name}␞');
  });

  it('keeps tabs and line breaks, and pictures the rest of the control characters', () => {
    expect(withControlPictures('a\tb\r\nc')).toBe('a\tb\r\nc');
    expect(withControlPictures('\u0000\u001b\u007f')).toBe('␀␛␡');
  });
});
