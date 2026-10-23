import type { AttributesApi } from '@shared/api/attributes';
import type { AttributeType, AttributeValue } from '@shared/domain/attribute';
import type { Place } from '@shared/domain/place';
import { FOUND_ATTRIBUTE_TYPES, FOUND_ATTRIBUTE_VALUES } from '../cm/attributeRecords';
import { cmPlace } from '../cm/cmPlace';
import { equalsCondition, findQueryArgs, queryOn } from '../cm/findQuery';
import { parseRecords, readRecords, recordFormat } from '../cm/formatRecords';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

/** Enough to see which values an attribute takes without reading every release note ever written. */
const USED_VALUES_SAMPLE = 500;

export function createAttributesService({ cm }: ServiceContext): AttributesApi {
  async function listTypes(place: Place): Promise<AttributeType[]> {
    const at = cmPlace(place);
    const output = await cm.query(findQueryArgs(FOUND_ATTRIBUTE_TYPES, '', at.repository), at.options);
    return readRecords(FOUND_ATTRIBUTE_TYPES, output);
  }

  async function createType(place: Place, name: string, comment: string): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['attribute', 'create', at.newObject('att', name)], at.options);
    if (comment) await editTypeComment(place, name, comment);
  }

  async function renameType(place: Place, name: string, newName: string): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['attribute', 'rename', at.spec(`att:${name}`), newName], at.options);
  }

  async function editTypeComment(place: Place, name: string, comment: string): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['attribute', 'edit', at.spec(`att:${name}`), comment], at.options);
  }

  async function deleteType(place: Place, names: string[]): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['attribute', 'delete', ...names.map((name) => at.spec(`att:${name}`))], at.options);
  }

  /** `objectSpec` as the object's lists name it (`br:/main`): the query names the repository, never the spec. */
  async function valuesOf(place: Place, objectSpec: string): Promise<AttributeValue[]> {
    const at = cmPlace(place);
    const query = `where ${equalsCondition('srcobj', objectSpec)}`;
    const output = await cm.query(findQueryArgs(FOUND_ATTRIBUTE_VALUES, query, at.repository), at.options);
    return readRecords(FOUND_ATTRIBUTE_VALUES, output);
  }

  async function usedValues(place: Place, attribute: string): Promise<string[]> {
    const at = cmPlace(place);
    const query = queryOn(`where ${equalsCondition('type', attribute)} limit ${USED_VALUES_SAMPLE}`, at.repository);
    const output = await cm.query(['find', 'attribute', query, `--format=${recordFormat(['value'])}`, '--nototal'], at.options);
    return parseRecords(output).map(([value = '']) => value.trim());
  }

  function setValue(place: Place, objectSpec: string, attribute: string, value: string): Promise<void> {
    const at = cmPlace(place);
    // Values may span several lines (e.g. Markdown), so they always travel through a file.
    return withTempFile(value, async (valueFile) => {
      await cm.query(['attribute', 'set', at.spec(`att:${attribute}`), at.spec(objectSpec), `--valuecontents=${valueFile}`], at.options);
    });
  }

  async function unsetValue(place: Place, objectSpec: string, attribute: string): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['attribute', 'unset', at.spec(`att:${attribute}`), at.spec(objectSpec)], at.options);
  }

  return { listTypes, createType, renameType, editTypeComment, deleteType, valuesOf, usedValues, setValue, unsetValue };
}
