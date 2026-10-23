import { Building2, Cloud, HardDrive, Server } from 'lucide-react';
import { serverKind } from '@shared/domain/organizations';
import { isCloudServer } from '../lib/servers';

/** A building for Unity organizations, a cloud for cloud organizations, a drive for this computer, a server otherwise. */
export function ServerIcon({ server, size = 15 }: { server: string; size?: number }) {
  const kind = serverKind(server);
  if (kind === 'local') return <HardDrive size={size} />;
  if (kind === 'unityOrganization') return <Building2 size={size} />;
  // `*@cloud`, the profile for every organization, is on Unity Cloud too.
  if (kind === 'cloudOrganization' || isCloudServer(server)) return <Cloud size={size} />;
  return <Server size={size} />;
}
