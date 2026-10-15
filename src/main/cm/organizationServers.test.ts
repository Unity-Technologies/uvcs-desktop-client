import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { machineReadableStatusHeader, UNITY_ORGANIZATION } from './testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from './testing/fakeCmClient';
import { isOrganizationIdServer, OrganizationServers } from './organizationServers';

const GAME = join(tmpdir(), 'wkspaces', 'game');
const TOOLS = join(tmpdir(), 'wkspaces', 'tools');

function servers(header: CmAnswer = machineReadableStatusHeader('game', UNITY_ORGANIZATION.byName)) {
  const fake = fakeCmClient({ 'status --header --machinereadable': header });
  return { ...fake, organizations: new OrganizationServers(fake.cm) };
}

describe('isOrganizationIdServer', () => {
  it('tells a Unity organization by its id from any server by name', () => {
    expect(isOrganizationIdServer(UNITY_ORGANIZATION.byId)).toBe(true);
    const named = ['AcmeStudio@unity', 'acme@cloud', '*@cloud', 'local', 'ssl://host:8088', '2398571046213@unity', '123@cloud.cn'];
    expect(named.filter(isOrganizationIdServer)).toEqual([]);
  });
});

describe('OrganizationServers', () => {
  it('names an organization by its id with one local command a session, however many workspaces of it ask at once', async () => {
    const { organizations, commands } = servers();

    const names = await Promise.all([
      organizations.nameOfWorkspaceServer(GAME, UNITY_ORGANIZATION.byId, GAME),
      organizations.nameOfWorkspaceServer(TOOLS, UNITY_ORGANIZATION.byId),
    ]);
    const later = await organizations.nameOfWorkspaceServer(TOOLS, UNITY_ORGANIZATION.byId);

    expect([...names, later]).toEqual(['AcmeStudio@unity', 'AcmeStudio@unity', 'AcmeStudio@unity']);
    expect(commands).toMatchObject([{ via: 'query', args: ['status', '--header', '--machinereadable', '--fieldseparator=|', GAME], options: { cwd: GAME } }]);
    expect(organizations.nameOf(UNITY_ORGANIZATION.byId)).toBe('AcmeStudio@unity');
  });

  it('asks nothing for a server already named', async () => {
    const { organizations, commands } = servers();

    expect(await organizations.nameOfWorkspaceServer(GAME, 'acme@cloud')).toBe('acme@cloud');
    expect(await organizations.nameOfWorkspaceServer(GAME, 'local')).toBe('local');
    expect(commands).toEqual([]);
  });

  it("names nothing it hasn't learned from a workspace on it", () => {
    expect(servers().organizations.nameOf(UNITY_ORGANIZATION.byId)).toBe(UNITY_ORGANIZATION.byId);
  });

  it("keeps the id when cm can't name it, and asks again the next time", async () => {
    const { organizations, commands } = servers(cmFails('The workspace is locked.'));

    expect(await organizations.nameOfWorkspaceServer(GAME, UNITY_ORGANIZATION.byId)).toBe(UNITY_ORGANIZATION.byId);
    expect(await organizations.nameOfWorkspaceServer(GAME, UNITY_ORGANIZATION.byId)).toBe(UNITY_ORGANIZATION.byId);
    expect(commands).toHaveLength(2);
  });
});
