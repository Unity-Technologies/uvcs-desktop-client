import type { AttributeType, AttributeValue } from '../domain/attribute';

export interface AttributesApi {
  listTypes(workspacePath: string): Promise<AttributeType[]>;
  createType(workspacePath: string, name: string, comment: string): Promise<void>;
  renameType(workspacePath: string, name: string, newName: string): Promise<void>;
  editTypeComment(workspacePath: string, name: string, comment: string): Promise<void>;
  deleteType(workspacePath: string, names: string[]): Promise<void>;
  /** Attribute values of a branch, changeset or label spec, e.g. `br:/main/task`. */
  valuesOf(workspacePath: string, objectSpec: string): Promise<AttributeValue[]>;
  setValue(workspacePath: string, objectSpec: string, attribute: string, value: string): Promise<void>;
  unsetValue(workspacePath: string, objectSpec: string, attribute: string): Promise<void>;
}
