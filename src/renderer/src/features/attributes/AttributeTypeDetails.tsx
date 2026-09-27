import { Tags } from 'lucide-react';
import type { AttributeType } from '@shared/domain/attribute';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { useSettled } from '../../lib/useSettled';
import { DetailsEmpty, DetailsPanel, DetailsSection, DetailsSkeleton } from '../../ui/DetailsPanel';
import { saveAttributeComment } from './attributeOperations';
import { attributeTone, valueCounts } from './attributeValues';
import { useAttributeUsedValues } from './useAttributes';
import styles from './AttributeChips.module.css';

interface AttributeTypeDetailsProps {
  workspacePath: string;
  type: AttributeType;
  menu: MenuEntry[];
}

export function AttributeTypeDetails({ workspacePath, type, menu }: AttributeTypeDetailsProps) {
  return (
    <DetailsPanel
      icon={<Tags />}
      kind="Attribute"
      heading={<DetailsHeading name={type.name} comment={type.comment} onSave={(comment) => saveAttributeComment(workspacePath, type, comment)} />}
      author={{ user: type.owner, date: type.date }}
      menu={menu}
      properties={[
        { label: 'Created', value: formatDateTime(type.date) },
        { label: 'Repository', value: type.repository },
      ]}
    >
      <UsedValues attribute={type.name} />
    </DetailsPanel>
  );
}

/** The values the attribute takes, most used first, so its meaning reads at a glance; asked for once the selection settles. */
function UsedValues({ attribute }: { attribute: string }) {
  const { data: used } = useAttributeUsedValues(attribute, useSettled());
  const counts = used ? valueCounts(used) : [];

  return (
    <DetailsSection title="Values">
      {!used ? (
        <DetailsSkeleton rows={1} />
      ) : counts.length === 0 ? (
        <DetailsEmpty>{used.length === 0 ? 'Not set on any branch, changeset or label yet.' : 'Only set to long texts, like release notes.'}</DetailsEmpty>
      ) : (
        <div className={styles.usedValues}>
          {counts.map(({ value, count }) => (
            <span key={value} className={styles.pill} data-tone={attributeTone(value)} data-tip={`Set ${count === 1 ? 'once' : `${count} times`}`}>
              {value}
              {count > 1 && <span className={styles.pillCount}>{count}</span>}
            </span>
          ))}
        </div>
      )}
    </DetailsSection>
  );
}
