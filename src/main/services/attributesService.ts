import type { AttributesApi } from '@shared/api/attributes';
import type { AttributeType, AttributeValue } from '@shared/domain/attribute';
import { escapeQueryValue } from '../cm/findQuery';
import { findRecords } from '../cm/findObjects';
import { integer, text } from '../cm/parseXml';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

export function createAttributesService({ cm }: ServiceContext): AttributesApi {
  async function listTypes(workspacePath: string): Promise<AttributeType[]> {
    const xml = await cm.query(['find', 'attributetype', '--xml', '--nototal'], { cwd: workspacePath });
    return findRecords(xml, 'ATTRIBUTEENTITY').map((record) => ({
      id: integer(record.ID),
      name: text(record.NAME),
      comment: text(record.COMMENT),
      owner: text(record.OWNER),
      date: text(record.DATE),
      repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`,
    }));
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
    const query = `where srcobj = '${escapeQueryValue(objectSpec)}'`;
    const xml = await cm.query(['find', 'attribute', query, '--xml', '--nototal'], { cwd: workspacePath });
    return findRecords(xml, 'ATTRIBUTE').map((record) => ({ name: text(record.NAME), value: text(record.VALUE) }));
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

  return { listTypes, createType, renameType, editTypeComment, deleteType, valuesOf, setValue, unsetValue };
}
