import { Cloud, HardDrive, Server } from 'lucide-react';
import { isCloudServer } from '../lib/servers';

/** A cloud for Unity Cloud organizations, a drive for this computer, a server otherwise. */
export function ServerIcon({ server, size = 15 }: { server: string; size?: number }) {
  if (server === 'local') return <HardDrive size={size} />;
  if (isCloudServer(server)) return <Cloud size={size} />;
  return <Server size={size} />;
}
