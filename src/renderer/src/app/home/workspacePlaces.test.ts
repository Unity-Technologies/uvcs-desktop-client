import { describe, expect, it } from 'vitest';
import { isInPlace, matchingPlaces, placeChoices, placeLabel, placeOf, samePlace } from './workspacePlaces';

const GAME = { repository: 'Racing/Game@studio@unity' };
const ART = { repository: 'Racing/Art@studio@unity' };
const EDITOR = { repository: 'Cloud Repositories/TextEditor@studio@unity' };
const LEGACY = { repository: 'codice@codice@cloud' };
const LOCAL = { repository: 'demo@local' };
const NESTED_ON_CLOUD = { repository: 'acme/tools@acme@cloud' };
const RESOLVING = { repository: undefined };
const UNKNOWN = { repository: null };

describe('placeOf', () => {
  it("takes a Unity organization's project from the repository's name", () => {
    expect(placeOf(GAME)).toEqual({ server: 'studio@unity', project: 'Racing' });
    expect(placeOf({ repository: 'Racing/Tools/Build@studio@unity' })).toEqual({ server: 'studio@unity', project: 'Racing' });
  });

  it('takes only the server elsewhere, a / in a name being part of it there', () => {
    expect(placeOf(LEGACY)).toEqual({ server: 'codice@cloud' });
    expect(placeOf(NESTED_ON_CLOUD)).toEqual({ server: 'acme@cloud' });
    expect(placeOf({ repository: 'legacy@studio@unity' })).toEqual({ server: 'studio@unity' });
  });

  it('has none while the repository is unknown', () => {
    expect(placeOf(RESOLVING)).toBeUndefined();
    expect(placeOf(UNKNOWN)).toBeUndefined();
  });
});

describe('placeChoices', () => {
  it('lists the servers as the sidebar orders them, each Unity organization with its projects, counted', () => {
    const choices = placeChoices([LOCAL, LEGACY, GAME, EDITOR, ART, RESOLVING, UNKNOWN]);

    expect(choices.map(({ label, detail, workspaceCount }) => [label, detail, workspaceCount])).toEqual([
      ['studio', undefined, 3],
      ['Cloud Repositories', 'studio', 1],
      ['Racing', 'studio', 2],
      ['codice', undefined, 1],
      ['This computer', undefined, 1],
    ]);
    expect(choices[2]?.place).toEqual({ server: 'studio@unity', project: 'Racing' });
  });

  it('lists nothing for no workspace whose repository is known', () => {
    expect(placeChoices([RESOLVING])).toEqual([]);
  });
});

describe('matchingPlaces', () => {
  it("finds a project by its own name or its organization's, under its organization", () => {
    const choices = placeChoices([GAME, EDITOR, LEGACY]);

    expect(matchingPlaces(choices, 'racing').map((choice) => choice.label)).toEqual(['studio', 'Racing']);
    expect(matchingPlaces(choices, 'studio cloud').map((choice) => choice.label)).toEqual(['studio', 'Cloud Repositories']);
  });

  it("tells two organizations' projects of the same name apart by their organizations", () => {
    const choices = placeChoices([EDITOR, { repository: 'Cloud Repositories/Sample@other@unity' }]);

    expect(matchingPlaces(choices, 'cloud repositories').map((choice) => choice.label)).toEqual(['other', 'Cloud Repositories', 'studio', 'Cloud Repositories']);
  });

  it('finds an organization alone by its name', () => {
    expect(matchingPlaces(placeChoices([LEGACY, GAME]), 'codice').map((choice) => choice.label)).toEqual(['codice']);
  });
});

describe('isInPlace', () => {
  it("keeps a project's workspaces, or all of an organization's", () => {
    const project = { server: 'studio@unity', project: 'Racing' };

    expect([GAME, ART, EDITOR, LEGACY].map((entry) => isInPlace(entry, project))).toEqual([true, true, false, false]);
    expect([GAME, EDITOR, LEGACY].map((entry) => isInPlace(entry, { server: 'studio@unity' }))).toEqual([true, true, false]);
  });

  it('keeps every workspace everywhere, and none whose repository is unknown somewhere', () => {
    expect(isInPlace(RESOLVING, null)).toBe(true);
    expect(isInPlace(RESOLVING, { server: 'studio@unity' })).toBe(false);
  });
});

describe('placeLabel', () => {
  it('names the place picked for the chip', () => {
    expect(placeLabel(null)).toBe('Everywhere');
    expect(placeLabel({ server: 'studio@unity' })).toBe('studio');
    expect(placeLabel({ server: 'studio@unity', project: 'Racing' })).toBe('Racing · studio');
    expect(placeLabel({ server: 'local' })).toBe('This computer');
  });
});

describe('samePlace', () => {
  it('tells a project from its organization', () => {
    expect(samePlace({ server: 'studio@unity' }, { server: 'studio@unity', project: 'Racing' })).toBe(false);
    expect(samePlace({ server: 'studio@unity', project: 'Racing' }, { server: 'studio@unity', project: 'Racing' })).toBe(true);
    expect(samePlace(null, null)).toBe(true);
  });
});
