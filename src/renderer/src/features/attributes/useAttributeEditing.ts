import { useState } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { isAffectedByAttributes } from '../../app/refresh/refreshScopes';
import { usePlace } from '../../app/workspace/useWorkspace';
import { useAttributeTypes, useAttributeValues } from './useAttributes';

/** The attribute the panel under the chips shows: its value being edited, or a long value being read. */
export type OpenedAttribute = { name: string; mode: 'edit' | 'read' };

export interface AttributeEditing {
  /** The object's values, undefined until read. */
  values: AttributeValue[] | undefined;
  types: { name: string }[];
  /** The attribute being added, shown as a chip with an empty value until it's saved. */
  adding: string | null;
  /** The chips' rows: the values and the one being added. */
  rows: AttributeValue[];
  opened: OpenedAttribute | null;
  open: (opened: OpenedAttribute | null) => void;
  add: (attribute: string) => void;
  /** Saves a quick value, closing its editor first. */
  save: (attribute: string, value: string) => Promise<void>;
  /** Saves a text, resolving to whether it saved, so a failure leaves its editor open. */
  setValue: (attribute: string, value: string) => Promise<boolean>;
  remove: (attribute: string) => void;
  close: () => void;
}

/**
 * The reads and edits behind an object's attribute chips, shared by the chips and the Add that a details panel's
 * section puts in its title (`AttributesDetailsSection`). Callers key it by the object's spec, so another object starts
 * with nothing opened or being added.
 */
export function useAttributeEditing(objectSpec: string): AttributeEditing {
  const place = usePlace();
  const { data: values } = useAttributeValues(objectSpec);
  const { data: types = [] } = useAttributeTypes();
  const [adding, setAdding] = useState<string | null>(null);
  const [opened, setOpened] = useState<OpenedAttribute | null>(null);

  const close = (): void => {
    setOpened(null);
    setAdding(null);
  };

  const setValue = async (attribute: string, value: string): Promise<boolean> => {
    const set = async (): Promise<true> => {
      await api.attributes.setValue(place, objectSpec, attribute, value);
      return true;
    };
    return (await runAction(place, `Couldn't set ${attribute}`, set, isAffectedByAttributes)) === true;
  };

  // A quick value closes as it saves; a text stays open until it's saved, so a failure leaves it to try again.
  const save = async (attribute: string, value: string): Promise<void> => {
    close();
    await setValue(attribute, value);
  };

  const remove = (attribute: string): void => {
    if (opened?.name === attribute) close();
    void runAction(place, `Couldn't remove ${attribute}`, () => api.attributes.unsetValue(place, objectSpec, attribute), isAffectedByAttributes);
  };

  const add = (attribute: string): void => {
    setAdding(attribute);
    setOpened({ name: attribute, mode: 'edit' });
  };

  const rows = values ? (adding ? [...values, { name: adding, value: '' }] : values) : [];
  return { values, types, adding, rows, opened, open: setOpened, add, save, setValue, remove, close };
}
