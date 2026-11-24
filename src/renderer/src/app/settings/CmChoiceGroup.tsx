import { useQuery } from '@tanstack/react-query';
import { Monitor, Package } from 'lucide-react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useCmRuntimeStore } from '../cmSetup/cmRuntimeStore';
import { IMMUTABLE_QUERY } from '../queryMeta';
import { cmChoiceCards, cmChoiceNote } from './cmChoiceCards';
import { SettingsChoice } from './SettingsChoice';
import { SettingsGroup } from './SettingsGroup';
import { useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

const ICONS = { automatic: <Monitor size={18} />, managed: <Package size={18} /> };

/** Which Unity Version Control the app runs: the installed one when there is one, or always its own (docs/features/cm-runtime.md). */
export function CmChoiceGroup() {
  const { cmChoice } = useSettings();
  const status = useCmRuntimeStore((state) => state.status);
  const pinned = useQuery({ queryKey: queryKeys.pinnedCmVersion, queryFn: () => api.cmRuntime.pinnedVersion(), staleTime: Infinity, meta: IMMUTABLE_QUERY });
  // One `cm version` of the installed one, each time Settings opens: it may have been installed or updated meanwhile.
  const installed = useQuery({ queryKey: queryKeys.installedCm, queryFn: () => api.cmRuntime.installedCm(), staleTime: 0, gcTime: 0 });
  if (status.kind !== 'ready' || pinned.data === undefined) return null;
  const cards = cmChoiceCards({ choice: cmChoice, pinnedVersion: pinned.data, installed: installed.data, source: status.source, switchingToOwn: status.switchingToOwn });
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
          />
        ))}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </SettingsGroup>
  );
}
