import { Tags } from 'lucide-react';
import type { AttributeType } from '@shared/domain/attribute';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
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
      heading={<DetailsHeading name={type.name} comment={type.comment} onSave={(comment) => saveAttributeComment(workspacePath, type, comment)} />}
      author={{ user: type.owner, date: type.date }}
      menu={menu}
    >
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
