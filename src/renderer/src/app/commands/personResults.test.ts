import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { MINE } from '../../lib/peopleFilter';
import { useChangesetFilters } from '../../features/changesets/changesetsViewStore';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { palettePeople, personResult } from './personResults';

describe('palettePeople', () => {
  it("offers each owner and each person the views showed once, the user first, then by the name shown", () => {
    expect(palettePeople(['zoe', 'ana.diaz', 'tom', 'ana.diaz', ''], ['bob', 'zoe'], 'tom')).toEqual(['tom', 'ana.diaz', 'bob', 'zoe']);
  });

  it('offers the user even when they own nothing the palette read, and no one first while the user is unread', () => {
    expect(palettePeople(['ana'], [], 'tom')).toEqual(['tom', 'ana']);
    expect(palettePeople(['zoe', 'ana'], [], undefined)).toEqual(['ana', 'zoe']);
  });

  it('keeps names in any script and as `cm` names them on each server', () => {
    expect(palettePeople(['josé.núñez', 'ACME\\tom', 'ana@acme.com'], [], undefined)).toEqual(['ACME\\tom', 'ana@acme.com', 'josé.núñez']);
  });
});

describe('personResult', () => {
  it('shows the name, how `cm` names them, and says which is the user', () => {
    expect(personResult('ana.diaz@acme.com', 'tom')).toMatchObject({ label: 'Ana Diaz', detail: 'ana.diaz@acme.com' });
    expect(personResult('tom', 'tom')).toMatchObject({ label: 'Tom', detail: 'tom · you' });
  });

  it("opens the Changesets view on the person's changesets, Mine for the user", () => {
    personResult('ana.diaz', 'tom').run();
    expect(useChangesetFilters.getState().people).toEqual({ mine: false, others: ['ana.diaz'] });
    expect(whereTheWindowIs().view).toBe('changesets');

    personResult('tom', 'tom').run();
    expect(useChangesetFilters.getState().people).toEqual(MINE);
  });
});
