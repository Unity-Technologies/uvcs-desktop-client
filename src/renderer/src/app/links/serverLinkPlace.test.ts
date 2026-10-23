import { describe, expect, it } from 'vitest';
import { serverLinkPlace } from './serverLinkPlace';

const profile = (server: string) => ({ server, user: 'ana', workingMode: 'SSOWorkingMode' });

describe('serverLinkPlace', () => {
  it("leads to the server as the user's profiles name it, the project the link names picked", () => {
    expect(serverLinkPlace({ kind: 'server', server: 'mycroquerorg@unity', project: 'Racing' }, [profile('MyCroquerOrg@unity')])).toEqual({
      server: 'MyCroquerOrg@unity',
      project: 'Racing',
    });
    expect(serverLinkPlace({ kind: 'server', server: 'build:8088' }, [profile('ssl://build:8088')]).server).toBe('ssl://build:8088');
  });

  it('shows all projects for a link naming none', () => {
    expect(serverLinkPlace({ kind: 'server', server: 'acme@unity' }, [])).toEqual({ server: 'acme@unity', project: null });
  });
});
