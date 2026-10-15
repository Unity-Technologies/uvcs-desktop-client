import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CmClient } from './CmClient';
import { isOrganizationIdServer, namesOrganizationById, warnOnOrganizationIds } from './organizationIds';
import { UNITY_ORGANIZATION } from './testing/cmOutput';

describe('isOrganizationIdServer', () => {
  it('tells a Unity organization by its id from any server by name', () => {
    expect(isOrganizationIdServer(UNITY_ORGANIZATION.byId)).toBe(true);
    const named = ['AcmeStudio@unity', 'acme@cloud', '*@cloud', 'local', 'ssl://host:8088', '2398571046213@unity', '123@cloud.cn'];
    expect(named.filter(isOrganizationIdServer)).toEqual([]);
  });
});

describe('namesOrganizationById', () => {
  it('finds the id form anywhere in a spec or an option, but in a profile, whose name it is', () => {
    expect(namesOrganizationById(['cat', `revid:45@game@${UNITY_ORGANIZATION.byId}`])).toBe(true);
    expect(namesOrganizationById(['find', 'revision', `where itemid = 7 on repository 'game@${UNITY_ORGANIZATION.byId}'`])).toBe(true);
    expect(namesOrganizationById(['checkconnection', UNITY_ORGANIZATION.byId])).toBe(true);
    expect(namesOrganizationById(['lock', 'list', `--repository=game@${UNITY_ORGANIZATION.byId}`])).toBe(true);
    expect(namesOrganizationById(['profile', 'delete', `--name=${UNITY_ORGANIZATION.byId}`])).toBe(false);
    expect(namesOrganizationById(['cat', `revid:45@game@${UNITY_ORGANIZATION.byName}`, 'cs:5@cloud'])).toBe(false);
  });
});

describe('warnOnOrganizationIds', () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns in development builds when a command names an organization's server by its id", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let started: Parameters<CmClient['onCommandStarted']>[0] = () => undefined;
    warnOnOrganizationIds({ onCommandStarted: (listener) => ((started = listener), () => undefined) });
    const run = (args: string[]) => started({ args, cwd: '/wk', finished: Promise.resolve() });

    run(['cat', `revid:45@game@${UNITY_ORGANIZATION.byName}`]);
    run(['profile', 'list']);
    run(['cat', `revid:45@game@${UNITY_ORGANIZATION.byId}`]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(`[organization id] cm cat revid:45@game@${UNITY_ORGANIZATION.byId}`);
  });
});
