import { Cloud, HardDrive, Server } from 'lucide-react';
import { serverKind } from '@shared/domain/organizations';
import { isCloudServer } from '../lib/servers';
import { OrganizationIcon } from './OrganizationIcon';

/** Unity's building for Unity organizations, a cloud for cloud organizations, a drive for this computer, a server otherwise. */
export function ServerIcon({ server, size = 15 }: { server: string; size?: number }) {
  const kind = serverKind(server);
  if (kind === 'local') return <HardDrive size={size} />;
  if (kind === 'unityOrganization') return <OrganizationIcon size={size} />;
  // `*@cloud`, the profile for every organization, is on Unity Cloud too.
  if (kind === 'cloudOrganization' || isCloudServer(server)) return <Cloud size={size} />;
  return <Server size={size} />;
}
