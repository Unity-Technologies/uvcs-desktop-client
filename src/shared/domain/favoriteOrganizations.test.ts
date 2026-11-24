import { describe, expect, it } from 'vitest';
import { isFavoriteOrganization, withFavoriteOrganization } from './favoriteOrganizations';

describe('favorite organizations', () => {
  it('adds an organization once, and removes it', () => {
    const added = withFavoriteOrganization(withFavoriteOrganization([], 'acme@unity', true), 'acme@unity', true);
    expect(added).toEqual(['acme@unity']);
    expect(withFavoriteOrganization(added, 'acme@unity', false)).toEqual([]);
  });

  it('keeps the other favorites when one changes', () => {
    expect(withFavoriteOrganization(['acme@unity', 'games@cloud'], 'acme@unity', false)).toEqual(['games@cloud']);
    expect(withFavoriteOrganization(['acme@unity'], 'games@cloud', true)).toEqual(['acme@unity', 'games@cloud']);
  });

  it('matches a server whatever its case, as cm and links may write it either way', () => {
    expect(isFavoriteOrganization(['Acme@unity'], 'acme@unity')).toBe(true);
    expect(withFavoriteOrganization(['Acme@unity'], 'acme@unity', false)).toEqual([]);
  });

  it('tells an organization of Unity from the cloud organization of the same name', () => {
    expect(isFavoriteOrganization(['acme@unity'], 'acme@cloud')).toBe(false);
  });
});
