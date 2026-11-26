import { describe, expect, it } from 'vitest';
import { parseRepositoryGuid } from './stableIds';

describe('parseRepositoryGuid', () => {
  it('reads a GUID as cm prints it', () => {
    expect(parseRepositoryGuid('5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61')).toBe('5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61');
  });

  it('writes one GUID one way, whatever its case and the spaces around it', () => {
    expect(parseRepositoryGuid(' 5B0C3A52-1D7E-4F0B-9C4F-3E2A8B9D7C61\r')).toBe('5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61');
  });

  it('takes no name, however close to a GUID, nor an empty field', () => {
    expect(parseRepositoryGuid('game')).toBeUndefined();
    expect(parseRepositoryGuid('5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61@acme@unity')).toBeUndefined();
    expect(parseRepositoryGuid('')).toBeUndefined();
  });
});
