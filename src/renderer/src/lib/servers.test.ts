import { describe, expect, it } from 'vitest';
import { cloudOrganization, describeServer, isCloudServer, serverChoiceLabel, splitRepositorySpec } from './servers';

describe('servers', () => {
  it('tells cloud organizations from on-premises servers', () => {
    expect(isCloudServer('acme@unity')).toBe(true);
    expect(isCloudServer('*@cloud')).toBe(true);
    expect(isCloudServer('ssl://host:8088')).toBe(false);
    expect(cloudOrganization('acme@cloud')).toBe('acme');
    expect(cloudOrganization('*@cloud')).toBeNull();
  });

  it('describes a server for people', () => {
    expect(describeServer('local')).toEqual({ label: 'This computer' });
    expect(describeServer('acme@cloud')).toEqual({ label: 'acme', detail: 'Cloud' });
    expect(describeServer('*@cloud')).toEqual({ label: 'Any cloud organization', detail: 'Cloud' });
    expect(describeServer('host:8087')).toEqual({ label: 'host:8087' });
  });

  it('names a server as a choice as the sidebar does', () => {
    expect(serverChoiceLabel('local')).toBe('This computer');
    expect(serverChoiceLabel('acme@cloud')).toBe('acme · Cloud');
    expect(serverChoiceLabel('ssl://host:8088')).toBe('ssl://host:8088');
  });

  it('splits a repository spec at its first @', () => {
    expect(splitRepositorySpec('acme@acme@cloud')).toEqual({ name: 'acme', server: 'acme@cloud' });
    expect(splitRepositorySpec('Cloud Repositories/Sample@local')).toEqual({ name: 'Cloud Repositories/Sample', server: 'local' });
  });
});
