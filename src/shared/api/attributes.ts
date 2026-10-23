import type { Place } from '../domain/place';
import type { AttributeType, AttributeValue } from '../domain/attribute';

export interface AttributesApi {
  listTypes(place: Place): Promise<AttributeType[]>;
  createType(place: Place, name: string, comment: string): Promise<void>;
  renameType(place: Place, name: string, newName: string): Promise<void>;
  editTypeComment(place: Place, name: string, comment: string): Promise<void>;
  deleteType(place: Place, names: string[]): Promise<void>;
  /** Attribute values of a branch, changeset or label spec, e.g. `br:/main/task`. */
  valuesOf(place: Place, objectSpec: string): Promise<AttributeValue[]>;
  /** Values the attribute has been given anywhere in the repository (a sample of the first ones found), to suggest them again. */
  usedValues(place: Place, attribute: string): Promise<string[]>;
  setValue(place: Place, objectSpec: string, attribute: string, value: string): Promise<void>;
  unsetValue(place: Place, objectSpec: string, attribute: string): Promise<void>;
}
