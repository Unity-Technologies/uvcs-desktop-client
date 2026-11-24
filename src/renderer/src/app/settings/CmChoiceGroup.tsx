import { useQuery } from '@tanstack/react-query';
import { Download, HardDrive, Package } from 'lucide-react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useCmRuntimeStore } from '../cmSetup/cmRuntimeStore';
import { PLATFORM } from '../../lib/platform';
import { Button } from '../../ui/Button';
import { IMMUTABLE_QUERY } from '../queryMeta';
import { cmChoiceCards, cmChoiceNote } from './cmChoiceCards';
import { SettingsChoice } from './SettingsChoice';
import { SettingsGroup } from './SettingsGroup';
import styles from './SettingsDialog.module.css';

const ICONS = { installed: <HardDrive size={18} />, managed: <Package size={18} /> };

/** Which Unity Version Control the app runs: the installed one, or its own (docs/features/cm-runtime.md). */
export function CmChoiceGroup() {
  const status = useCmRuntimeStore((state) => state.status);
  const pinned = useQuery({ queryKey: queryKeys.pinnedCmVersion, queryFn: () => api.cmRuntime.pinnedVersion(), staleTime: Infinity, meta: IMMUTABLE_QUERY });
  // One `cm version` of the installed one, each time Settings opens: it may have been installed or updated meanwhile.
  const installed = useQuery({ queryKey: queryKeys.installedCm, queryFn: () => api.cmRuntime.installedCm(), staleTime: 0, gcTime: 0 });
  if (status.kind !== 'ready' || pinned.data === undefined) return null;
  const cards = cmChoiceCards({
    pinnedVersion: pinned.data,
    installed: installed.data,
    source: status.source,
    switchingToOwn: status.switchingToOwn,
    officialUpdate: status.officialUpdate,
    canInstall: PLATFORM !== 'linux',
  });
  const update = async (): Promise<void> => {
    await api.cmRuntime.updateInstalled();
    // Its version changed once it worked: read again.
    void installed.refetch();
  };
  const note = cmChoiceNote(status.source);
  return (
    <SettingsGroup title="Command line client">
      <div className={styles.choices} role="radiogroup" aria-label="Command line client">
        {cards.map((card) => (
          <SettingsChoice
            key={card.choice}
            icon={ICONS[card.choice]}
            label={card.label}
            description={card.description}
            tip={card.tip}
            selected={card.selected}
            disabled={card.disabled}
            warning={card.warning}
            onSelect={() => void api.cmRuntime.use(card.choice)}
            action={
              card.updateLabel && (
                <Button variant="ghost" size="small" icon={<Download size={13} />} onClick={() => void update()}>
                  {card.updateLabel}
                </Button>
              )
            }
          />
        ))}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </SettingsGroup>
  );
}
