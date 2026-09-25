import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { DetailsEmpty, DetailsSection, DetailsSkeleton } from '../../ui/DetailsPanel';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { AttributeRow } from './AttributeRow';
import { useAttributeTypes, useAttributeValues } from './useAttributes';
import styles from './AttributesEditor.module.css';

/**
 * Shows and edits the attribute values of a branch, changeset or label.
 * Embed it in any details panel: `<AttributesEditor objectSpec="br:/main/task" />`.
 */
export function AttributesEditor({ objectSpec }: { objectSpec: string }) {
  const workspacePath = useWorkspacePath();
  const { data: values } = useAttributeValues(objectSpec);
  const { data: types = [] } = useAttributeTypes();
  const [adding, setAdding] = useState<string | null>(null);

  const unused = types.filter((type) => !values?.some((value) => value.name === type.name));
  const rows: AttributeValue[] = adding ? [...(values ?? []), { name: adding, value: '' }] : (values ?? []);

  const save = async (attribute: string, value: string): Promise<void> => {
    setAdding(null);
    await runAction(workspacePath, `Couldn't set ${attribute}`, () => api.attributes.setValue(workspacePath, objectSpec, attribute, value));
  };

  const remove = (attribute: string): Promise<void | undefined> =>
    runAction(workspacePath, `Couldn't remove ${attribute}`, () => api.attributes.unsetValue(workspacePath, objectSpec, attribute));

  const addMenu = unused.map((type) => ({ id: type.name, label: type.name, run: () => setAdding(type.name) }));

  return (
    <DetailsSection
      title="Attributes"
      action={
        unused.length > 0 && (
          <ActionDropdownMenu entries={addMenu}>
            <Button variant="ghost" size="small" icon={<Plus size={13} />}>
              Add
            </Button>
          </ActionDropdownMenu>
        )
      }
    >
      {!values ? (
        <DetailsSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <DetailsEmpty>No attributes yet.</DetailsEmpty>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <AttributeRow
              key={row.name}
              attribute={row}
              isNew={row.name === adding}
              onSave={(value) => void save(row.name, value)}
              onCancel={() => row.name === adding && setAdding(null)}
              onRemove={() => void remove(row.name)}
            />
          ))}
        </div>
      )}
    </DetailsSection>
  );
}
