import { describe, expect, it } from 'vitest';
import { parseRepositoryGuid } from '@shared/domain/stableIds';
import { listRepositories } from './listRepositories';
import { repositoryIdOf } from './repositoryIdOf';
import { RepositoryGuids } from './RepositoryGuids';
import { cmFails, fakeCmClient, type CmAnswer } from './testing/fakeCmClient';
import { formatOutput } from './testing/cmOutput';

const GAME = parseRepositoryGuid('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')!;
const TOOLS = parseRepositoryGuid('5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61')!;

/** `cm repository list` of acme@cloud as it prints it: id, name, server, owner, type, GUID. */
function listed(...repositories: [name: string, guid: string][]): string {
  return formatOutput(...repositories.map(([name, guid], index) => [String(index + 1), name, 'acme@cloud', 'ana', 'VCS', guid]));
}

/** As `cm ls` fails for a repository name its server doesn't know, under any name it ever had. */
const NO_SUCH_REPOSITORY = cmFails("The specified repository couldn't be found: nothing-here.");

/**
 * A server whose listing is each answer in turn, then the last one again, and whose repositories answer `cm ls` with
 * their id under each name in `ids` (a name a rename left behind, which `cm` still takes), failing for any other; the
 * clock moves only when the test says.
 */
function guidsOf(...listings: CmAnswer[]) {
  return guidsWithIds({}, ...listings);
}

function guidsWithIds(ids: Record<string, number>, ...listings: CmAnswer[]) {
  let calls = 0;
  const fake = fakeCmClient({
    'repository list': (command) => {
      const answer = listings[Math.min(calls++, listings.length - 1)] ?? '';
      return typeof answer === 'function' ? answer(command) : answer;
    },
    ls: ({ args }) => {
      const spec = args.find((arg) => arg.startsWith('--tree=cs:0@'))?.slice('--tree=cs:0@'.length) ?? '';
      const id = ids[spec.toLowerCase()];
      return id === undefined ? NO_SUCH_REPOSITORY : formatOutput([id]);
    },
  });
  const clock = { now: 0 };
  const guids = new RepositoryGuids({ list: (server) => listRepositories(fake.cm, server), idOf: (spec, server) => repositoryIdOf(fake.cm, spec, server), now: () => clock.now });
  return { ...fake, clock, guids, listings: () => fake.lines().filter((line) => line.startsWith('repository list')), idReads: () => fake.lines().filter((line) => line.startsWith('ls ')) };
}

describe('RepositoryGuids', () => {
  it("answers a repository's GUID from one listing of its server, whatever the case of its name and server", async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME], ['tools', TOOLS]));

    expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
    expect(await guids.guidOf('ACME@cloud', 'Tools')).toBe(TOOLS);
    expect(lines()).toHaveLength(1);
  });

  it("learns from the home screen's listing, so a lookup after it lists nothing", async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME]));

    await guids.list('acme@cloud');

    expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
    expect(lines()).toHaveLength(1);
  });

  it('sends one listing for lookups and a home screen asking at once', async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME], ['tools', TOOLS]));

    const answers = await Promise.all([guids.guidOf('acme@cloud', 'game'), guids.list('acme@cloud'), guids.guidOf('acme@cloud', 'tools')]);

    expect([answers[0], answers[2]]).toEqual([GAME, TOOLS]);
    expect(lines()).toHaveLength(1);
  });

  it('lists the server again for a name it lost track of, a rename made elsewhere, and finds it by its new name', async () => {
    const { guids, lines, clock } = guidsOf(listed(['game', GAME]), listed(['racer', GAME]));
    await guids.guidOf('acme@cloud', 'game');
    clock.now += 61_000;

    expect(await guids.guidOf('acme@cloud', 'racer')).toBe(GAME);
    expect(lines()).toHaveLength(2);
  });

  it('forgets the name a renamed repository left, so a new repository taking it never gets the old one’s GUID', async () => {
    const { guids, clock } = guidsOf(listed(['game', GAME]), listed(['racer', GAME], ['game', TOOLS]));
    await guids.guidOf('acme@cloud', 'game');
    clock.now += 61_000;

    await guids.guidOf('acme@cloud', 'racer');

    expect(await guids.guidOf('acme@cloud', 'game')).toBe(TOOLS);
  });

  it('answers a name missing from a listing this recent as unknown, without listing again', async () => {
    const { guids, listings, clock } = guidsOf(listed(['game', GAME]));
    await guids.guidOf('acme@cloud', 'game');
    clock.now += 59_000;

    expect(await guids.guidOf('acme@cloud', 'nothing-here')).toBeUndefined();
    expect(listings()).toHaveLength(1);
  });

  it('follows a rename made in the app at once, without listing again', async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME]));
    await guids.guidOf('acme@cloud', 'game');

    guids.renamed('acme@cloud', 'game', 'Racer');

    expect(await guids.guidOf('acme@cloud', 'racer')).toBe(GAME);
    expect(lines()).toHaveLength(1);
  });

  it('knows no GUID for a repository cm printed none for', async () => {
    const { guids } = guidsOf(listed(['game', '']));

    expect(await guids.guidOf('acme@cloud', 'game')).toBeUndefined();
  });

  it('rejects when the server can’t be listed, with the same failure for a minute without listing again, then lists it again', async () => {
    const { guids, lines, clock } = guidsOf(cmFails('Unable to connect to acme@cloud'), listed(['game', GAME]));

    await expect(guids.guidOf('acme@cloud', 'game')).rejects.toThrow('Unable to connect');
    clock.now += 59_000;
    await expect(guids.guidOf('acme@cloud', 'game')).rejects.toThrow('Unable to connect');
    await expect(guids.nameOf('acme@cloud', GAME)).rejects.toThrow('Unable to connect');
    expect(lines()).toHaveLength(1);

    clock.now += 2_000;
    expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
    expect(lines()).toHaveLength(2);
  });

  it('lists a server that failed again at once for the home screen, which the user asked for', async () => {
    const { guids, lines } = guidsOf(cmFails('Unable to connect to acme@cloud'), listed(['game', GAME]));
    await expect(guids.guidOf('acme@cloud', 'game')).rejects.toThrow('Unable to connect');

    await guids.list('acme@cloud');

    expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
    expect(lines()).toHaveLength(2);
  });

  it('finds a repository by its GUID under the name it goes by now, from the listing that taught it', async () => {
    const { guids, lines } = guidsOf(listed(['racer', GAME]));
    await guids.list('acme@cloud');

    expect(await guids.nameOf('acme@cloud', GAME)).toBe('racer');
    expect(lines()).toHaveLength(1);
  });

  it('lists the server again for a GUID it doesn’t know once the last listing is old: a repository renamed elsewhere', async () => {
    const { guids, lines, clock } = guidsOf(listed(['tools', TOOLS]), listed(['tools', TOOLS], ['racer', GAME]));
    await guids.list('acme@cloud');

    expect(await guids.nameOf('acme@cloud', GAME)).toBeUndefined();
    clock.now += 61_000;
    expect(await guids.nameOf('acme@cloud', GAME)).toBe('racer');
    expect(lines()).toHaveLength(2);
  });

  it('finds a repository renamed in the app by its new name, without listing again', async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME]));
    await guids.list('acme@cloud');

    guids.renamed('acme@cloud', 'game', 'Racer');

    expect(await guids.nameOf('acme@cloud', GAME)).toBe('Racer');
    expect(lines()).toHaveLength(1);
  });

  it('answers what a listing already taught without asking cm, and nothing for a server never listed', async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME]));

    expect(guids.knownGuidOf('acme@cloud', 'game')).toBeUndefined();
    await guids.list('acme@cloud');

    expect(guids.knownGuidOf('ACME@cloud', 'Game')).toBe(GAME);
    expect(lines()).toHaveLength(1);
  });

  it('lists the server again for a repository created here, however recent the last listing', async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME]), listed(['game', GAME], ['tools', TOOLS]));
    await guids.list('acme@cloud');

    guids.added('acme@cloud');

    expect(await guids.guidOf('acme@cloud', 'tools')).toBe(TOOLS);
    expect(lines()).toHaveLength(2);
  });

  it('keeps a spec kept with its GUID while its name still names the repository, from one listing', async () => {
    const { guids, lines } = guidsOf(listed(['game', GAME]));

    expect(await guids.specNow('game@acme@cloud', GAME)).toBe('game@acme@cloud');
    expect(lines()).toHaveLength(1);
  });

  it('follows a spec kept with its GUID to the name a rename made elsewhere gave it, in the same listing', async () => {
    const { guids, lines } = guidsOf(listed(['racer', GAME], ['game', TOOLS]));

    expect(await guids.specNow('game@acme@cloud', GAME)).toBe('racer@acme@cloud');
    expect(lines()).toHaveLength(1);
  });

  it('keeps the spec of a repository its server holds no more', async () => {
    const { guids } = guidsOf(listed(['tools', TOOLS]));

    expect(await guids.specNow('game@acme@cloud', GAME)).toBe('game@acme@cloud');
  });

  describe('a name a rename left behind, which a workspace of the repository keeps', () => {
    it('finds the repository by its id under the old name, with one listing and one cm ls', async () => {
      const { guids, listings, idReads } = guidsWithIds({ 'game@acme@cloud': 1 }, listed(['racer', GAME], ['tools', TOOLS]));

      expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
      expect([listings(), idReads()]).toEqual([[expect.stringMatching(/^repository list acme@cloud/)], [`ls / --tree=cs:0@game@acme@cloud --format={repid}\u001e`]]);
    });

    it('remembers the old name for the session, so it reads the id only once, trusting it again after a listing that shows no repository took it', async () => {
      const { guids, listings, idReads, clock } = guidsWithIds({ 'game@acme@cloud': 1 }, listed(['racer', GAME]));
      await guids.guidOf('acme@cloud', 'game');
      expect(guids.knownGuidOf('acme@cloud', 'game')).toBe(GAME);
      clock.now += 3_600_000;

      expect(guids.knownGuidOf('acme@cloud', 'game')).toBeUndefined();
      expect(await guids.guidOf('acme@cloud', 'Game')).toBe(GAME);
      expect([listings(), idReads()].map((lines) => lines.length)).toEqual([2, 1]);
    });

    it('gives the old name of a repository renamed here to a repository created here under it', async () => {
      const { guids } = guidsOf(listed(['game', GAME]), listed(['racer', GAME], ['game', TOOLS]));
      await guids.list('acme@cloud');
      guids.renamed('acme@cloud', 'game', 'racer');

      guids.added('acme@cloud');

      expect(guids.knownGuidOf('acme@cloud', 'game')).toBeUndefined();
      expect(await guids.guidOf('acme@cloud', 'game')).toBe(TOOLS);
    });

    it('gives an old name to the repository that took it elsewhere, once the listing is old', async () => {
      const { guids, clock } = guidsWithIds({ 'game@acme@cloud': 1 }, listed(['racer', GAME]), listed(['racer', GAME], ['game', TOOLS]));
      await guids.guidOf('acme@cloud', 'game');
      clock.now += 61_000;

      expect(await guids.guidOf('acme@cloud', 'game')).toBe(TOOLS);
    });

    it('reads the id once for lookups asking at once', async () => {
      const { guids, idReads } = guidsWithIds({ 'game@acme@cloud': 1 }, listed(['racer', GAME]));

      expect(await Promise.all([guids.guidOf('acme@cloud', 'game'), guids.guidOf('acme@cloud', 'game')])).toEqual([GAME, GAME]);
      expect(idReads()).toHaveLength(1);
    });

    it('answers a name no repository goes by as unknown, and asks nothing more for it within the minute', async () => {
      const { guids, lines, clock } = guidsOf(listed(['game', GAME]));

      expect(await guids.guidOf('acme@cloud', 'nothing-here')).toBeUndefined();
      clock.now += 59_000;
      expect(await guids.guidOf('acme@cloud', 'nothing-here')).toBeUndefined();
      expect(lines()).toHaveLength(2);
    });

    it('gives the name to a repository that took it since, as a listing shows', async () => {
      const { guids, clock } = guidsWithIds({ 'game@acme@cloud': 1 }, listed(['racer', GAME]), listed(['racer', GAME], ['game', TOOLS]));
      await guids.guidOf('acme@cloud', 'game');
      clock.now += 61_000;

      await guids.list('acme@cloud');

      expect(await guids.guidOf('acme@cloud', 'game')).toBe(TOOLS);
    });

    it('keeps the old name of a repository renamed here, which its workspaces still name', async () => {
      const { guids, lines, clock } = guidsOf(listed(['game', GAME]), listed(['racer', GAME]));
      await guids.list('acme@cloud');
      guids.renamed('acme@cloud', 'game', 'racer');
      clock.now += 61_000;
      await guids.list('acme@cloud');

      expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
      expect(lines()).toHaveLength(2);
    });

    it('follows a spec kept by the old name to the new one, without reading the id', async () => {
      const { guids, idReads } = guidsWithIds({ 'game@acme@cloud': 1 }, listed(['racer', GAME]));

      expect(await guids.specNow('game@acme@cloud', GAME)).toBe('racer@acme@cloud');
      expect(idReads()).toEqual([]);
    });
  });
});
