import { Lock as LockIcon, LockOpen } from 'lucide-react';
import type { Lock } from '@shared/domain/lock';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsBadge } from '../../ui/DetailsBadge';
import { DetailsPanel } from '../../ui/DetailsPanel';
import { DetailsSection } from '../../ui/DetailsSection';
import { PropertyList } from '../../ui/PropertyList';
import { isReleasable, releaseLocks } from './lockOperations';

export function LockDetails({ workspacePath, lock, menu }: { workspacePath: string; lock: Lock; menu: MenuEntry[] }) {
  const nameStart = lock.path.lastIndexOf('/') + 1;

  return (
    <DetailsPanel
      icon={<LockIcon />}
      kind="Lock"
      context={lock.path.slice(0, nameStart) || '/'}
      heading={<DetailsHeading name={lock.path.slice(nameStart)} />}
      author={{ user: lock.owner, date: lock.date }}
      badges={<DetailsBadge tone={isReleasable(lock) ? 'warning' : 'neutral'}>{lock.status}</DetailsBadge>}
      primaryAction={
        isReleasable(lock) && (
          <Button variant="primary" size="small" icon={<LockOpen size={13} />} onClick={() => void releaseLocks(workspacePath, [lock])}>
            Release
          </Button>
        )
      }
      menu={menu}
      primaryActionId="release"
    >
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Path', value: lock.path, mono: true, copyText: lock.path },
            { label: 'Locked', value: formatDateTime(lock.date) },
            { label: 'Held on', value: lock.holderBranch },
            { label: 'Released on', value: lock.destinationBranch },
            { label: 'Workspace', value: lock.workspace },
            { label: 'Repository', value: lock.repository },
            { label: 'GUID', value: lock.guid, mono: true, copyText: lock.guid },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
