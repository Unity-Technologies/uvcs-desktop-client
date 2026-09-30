import type { AttributesApi } from '@shared/api/attributes';
import type { AttributeType, AttributeValue } from '@shared/domain/attribute';
import { toAttributeType, toAttributeValue } from '../cm/attributeRecords';
import { equalsCondition } from '../cm/findQuery';
import { findRecords } from '../cm/findObjects';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

/** Enough to see which values an attribute takes without reading every release note ever written. */
const USED_VALUES_SAMPLE = 500;

export function createAttributesService({ cm }: ServiceContext): AttributesApi {
  async function listTypes(workspacePath: string): Promise<AttributeType[]> {
    const xml = await cm.query(['find', 'attributetype', '--xml', '--nototal'], { cwd: workspacePath });
    return findRecords(xml, 'ATTRIBUTEENTITY').map(toAttributeType);
  }

  async function createType(workspacePath: string, name: string, comment: string): Promise<void> {
    await cm.query(['attribute', 'create', name], { cwd: workspacePath });
    if (comment) await editTypeComment(workspacePath, name, comment);
  }

  async function renameType(workspacePath: string, name: string, newName: string): Promise<void> {
    await cm.query(['attribute', 'rename', `att:${name}`, newName], { cwd: workspacePath });
  }

  async function editTypeComment(workspacePath: string, name: string, comment: string): Promise<void> {
    await cm.query(['attribute', 'edit', `att:${name}`, comment], { cwd: workspacePath });
  }

  async function deleteType(workspacePath: string, names: string[]): Promise<void> {
    await cm.query(['attribute', 'delete', ...names.map((name) => `att:${name}`)], { cwd: workspacePath });
  }

  async function valuesOf(workspacePath: string, objectSpec: string): Promise<AttributeValue[]> {
    const query = `where ${equalsCondition('srcobj', objectSpec)}`;
    const xml = await cm.query(['find', 'attribute', query, '--xml', '--nototal'], { cwd: workspacePath });
    return findRecords(xml, 'ATTRIBUTE').map(toAttributeValue);
  }

  async function usedValues(workspacePath: string, attribute: string): Promise<string[]> {
    const query = `where ${equalsCondition('type', attribute)} limit ${USED_VALUES_SAMPLE}`;
    const output = await cm.query(['find', 'attribute', query, `--format=${recordFormat(['value'])}`, '--nototal'], { cwd: workspacePath });
    return parseRecords(output).map(([value]) => value ?? '');
  }

  function setValue(workspacePath: string, objectSpec: string, attribute: string, value: string): Promise<void> {
    // Values may span several lines (e.g. Markdown), so they always travel through a file.
    return withTempFile(value, async (valueFile) => {
      await cm.query(['attribute', 'set', `att:${attribute}`, objectSpec, `--valuecontents=${valueFile}`], { cwd: workspacePath });
    });
  }

  async function unsetValue(workspacePath: string, objectSpec: string, attribute: string): Promise<void> {
    await cm.query(['attribute', 'unset', `att:${attribute}`, objectSpec], { cwd: workspacePath });
  }

  return { listTypes, createType, renameType, editTypeComment, deleteType, valuesOf, usedValues, setValue, unsetValue };
}
