import { Tags } from 'lucide-react';
import type { AttributeType } from '@shared/domain/attribute';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { DetailsComment } from '../../ui/DetailsComment';
import { DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { saveAttributeComment } from './attributeOperations';

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
      title={type.name}
      author={{ user: type.owner, date: type.date }}
      menu={menu}
    >
      <DetailsComment text={type.comment} onSave={(comment) => saveAttributeComment(workspacePath, type, comment)} />
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(type.date) },
            { label: 'Repository', value: type.repository },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
