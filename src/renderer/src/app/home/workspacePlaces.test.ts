import { describe, expect, it } from 'vitest';
import { isInPlace, matchingPlaces, organizationsOf, placeChoices, placeLabel, placeOf, samePlace, workspacesShown } from './workspacePlaces';

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
  it('lists the servers as the sidebar orders them, each Unity organization with its projects, each once', () => {
    const choices = placeChoices([LOCAL, LEGACY, GAME, EDITOR, ART, RESOLVING, UNKNOWN]);

    expect(choices.map(({ label, detail }) => [label, detail])).toEqual([
      ['studio', undefined],
      ['Cloud Repositories', 'studio'],
      ['Racing', 'studio'],
      ['codice', undefined],
      ['This computer', undefined],
    ]);
    expect(choices[2]?.place).toEqual({ server: 'studio@unity', project: 'Racing' });
  });

  it("colors a project by the GUID its organization's list, once read, gives it, and leaves the others without", () => {
    const choices = placeChoices([GAME, EDITOR], new Map([['studio@unity', [{ name: 'Racing', guid: 'racing-guid' }]]]));

    expect(choices.map((choice) => [choice.label, choice.guid])).toEqual([
      ['studio', undefined],
      ['Cloud Repositories', undefined],
      ['Racing', 'racing-guid'],
    ]);
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

describe('organizationsOf', () => {
  it('names each Unity organization whose projects the workspaces are in, once', () => {
    expect(organizationsOf([GAME, ART, EDITOR, LEGACY, LOCAL, RESOLVING, { repository: 'Art/Main@other@unity' }])).toEqual(['other@unity', 'studio@unity']);
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

describe('workspacesShown', () => {
  const entry = (name: string, repository: string) => ({ workspace: { name, path: `/wk/${name}`, guid: name }, missing: false, repository });
  const entries = [entry('game', GAME.repository), entry('art', ART.repository), entry('editor', EDITOR.repository), entry('codice', LEGACY.repository)];

  it('shows the workspaces the search finds in the place picked', () => {
    expect(workspacesShown(entries, 'a', { server: 'studio@unity', project: 'Racing' }).map((shown) => shown.workspace.name)).toEqual(['game', 'art']);
    expect(workspacesShown(entries, 'art', { server: 'studio@unity', project: 'Racing' }).map((shown) => shown.workspace.name)).toEqual(['art']);
  });

  it('shows every workspace the search finds, everywhere', () => {
    expect(workspacesShown(entries, '', null)).toEqual(entries);
    expect(workspacesShown(entries, 'codice', null).map((shown) => shown.workspace.name)).toEqual(['codice']);
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
