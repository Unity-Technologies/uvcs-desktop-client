import { describe, expect, it } from 'vitest';
import { partialConfigureArgs } from './partialWorkspace';

describe('partialConfigureArgs', () => {
  it('loads each chosen folder, quietly', () => {
    expect(partialConfigureArgs(['Assets', 'Docs ñ'])).toEqual(['partial', 'configure', '+/Assets', '+/Docs ñ', '--silent']);
  });
});
