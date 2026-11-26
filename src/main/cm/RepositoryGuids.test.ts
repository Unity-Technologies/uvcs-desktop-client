import { describe, expect, it } from 'vitest';
import { listRepositories } from './listRepositories';
import { RepositoryGuids } from './RepositoryGuids';
import { cmFails, fakeCmClient, type CmAnswer } from './testing/fakeCmClient';
import { formatOutput } from './testing/cmOutput';

const GAME = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const TOOLS = '5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61';

/** `cm repository list` of acme@cloud as it prints it: id, name, server, owner, type, GUID. */
function listed(...repositories: [name: string, guid: string][]): string {
  return formatOutput(...repositories.map(([name, guid], index) => [String(index + 1), name, 'acme@cloud', 'ana', 'VCS', guid]));
}

/** A server whose listing is each answer in turn, then the last one again; the clock moves only when the test says. */
function guidsOf(...listings: CmAnswer[]) {
  let calls = 0;
  const fake = fakeCmClient({ 'repository list': (command) => {
    const answer = listings[Math.min(calls++, listings.length - 1)] ?? '';
    return typeof answer === 'function' ? answer(command) : answer;
  } });
  const clock = { now: 0 };
  return { ...fake, clock, guids: new RepositoryGuids((server) => listRepositories(fake.cm, server), () => clock.now) };
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
    const { guids, lines, clock } = guidsOf(listed(['game', GAME]));
    await guids.guidOf('acme@cloud', 'game');
    clock.now += 59_000;

    expect(await guids.guidOf('acme@cloud', 'nothing-here')).toBeUndefined();
    expect(lines()).toHaveLength(1);
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

  it('rejects when the server can’t be listed, and lists it again on the next lookup', async () => {
    const { guids, lines } = guidsOf(cmFails('Unable to connect to acme@cloud'), listed(['game', GAME]));

    await expect(guids.guidOf('acme@cloud', 'game')).rejects.toThrow('Unable to connect');
    expect(await guids.guidOf('acme@cloud', 'game')).toBe(GAME);
    expect(lines()).toHaveLength(2);
  });
});
