import { describe, expect, it } from 'vitest';
import { cmFails, fakeCmClient } from './testing/fakeCmClient';
import { UnityOrganizationIds } from './UnityOrganizationIds';

describe('UnityOrganizationIds', () => {
  it("reads a Unity organization's id once for the session, whatever the case of its name, with a quick local query", async () => {
    const { cm, lines, linesVia } = fakeCmClient({ 'getconfig organization AcmeStudio@unity': '1375943370549\n' });
    const ids = new UnityOrganizationIds(cm);

    expect(await ids.idOf('AcmeStudio@unity')).toBe('1375943370549');
    expect(await ids.idOf('acmestudio@unity')).toBe('1375943370549');
    expect(lines()).toEqual(['getconfig organization AcmeStudio@unity --format={unityid}']);
    expect(linesVia('query')).toHaveLength(1);
  });

  it("has none for an organization cm hasn't signed in to on this machine, and doesn't ask again", async () => {
    const { cm, lines } = fakeCmClient({ 'getconfig organization': cmFails("Organization configuration not found for 'arcade@unity'.") });
    const ids = new UnityOrganizationIds(cm);

    expect(await ids.idOf('arcade@unity')).toBeUndefined();
    expect(await ids.idOf('arcade@unity')).toBeUndefined();
    expect(lines()).toHaveLength(1);
  });

  it('asks again once told to forget, as cm may know an organization by a new name after a sign-in', async () => {
    const { cm, lines } = fakeCmClient({ 'getconfig organization': '1375943370549\n' });
    const ids = new UnityOrganizationIds(cm);
    await ids.idOf('acme@unity');

    ids.forget();
    await ids.idOf('acme@unity');

    expect(lines()).toHaveLength(2);
  });

  it('has none for what cm prints for no Unity organization (-1)', async () => {
    const { cm } = fakeCmClient({ 'getconfig organization': '-1\n' });

    expect(await new UnityOrganizationIds(cm).idOf('arcade@unity')).toBeUndefined();
  });

  it('asks nothing for a server that is no Unity organization', async () => {
    const { cm, lines } = fakeCmClient();
    const ids = new UnityOrganizationIds(cm);

    expect(await ids.idOf('acme@cloud')).toBeUndefined();
    expect(await ids.idOf('ssl://host:8088')).toBeUndefined();
    expect(await ids.idOf('local')).toBeUndefined();
    expect(lines()).toEqual([]);
  });
});
