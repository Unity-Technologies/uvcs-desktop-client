import { describe, expect, it } from 'vitest';
import { fieldLabelAttributes } from './fieldLabel';

describe('fieldLabelAttributes', () => {
  it('names the editor by the label that shows above it', () => {
    expect(fieldLabelAttributes('Comment', 'label-1')).toEqual({ 'aria-labelledby': 'label-1' });
  });

  it('names a field with no label shown by its own name', () => {
    expect(fieldLabelAttributes('Summary', undefined)).toEqual({ 'aria-label': 'Summary' });
  });
});
