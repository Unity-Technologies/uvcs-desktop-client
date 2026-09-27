export type XmlNode = Record<string, unknown>;

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const ENTITY = /&(lt|gt|amp|quot|apos);/g;
const NAME_END = /[\s/>]/g;

interface OpenElement {
  name: string;
  node: XmlNode | null;
  text: string;
}

/**
 * Reads XML into plain objects in one linear pass: an element with children becomes an object keyed by child name,
 * one with only text (or nothing) its trimmed text. Attributes, comments, declarations and doctypes are skipped. The
 * elements in `arrays` are always arrays; other names repeated under one parent become arrays too. Mixed text goes to
 * `#text`. Line breaks become `\n` and the five named entities are decoded; character references are left as they are.
 */
export function readXmlTree(xml: string, arrays: ReadonlySet<string>): XmlNode {
  const root: OpenElement = { name: '', node: {}, text: '' };
  const stack: OpenElement[] = [root];
  let position = 0;

  while (position < xml.length) {
    const tagStart = xml.indexOf('<', position);
    const textEnd = tagStart < 0 ? xml.length : tagStart;
    if (textEnd > position) stack[stack.length - 1]!.text += xml.slice(position, textEnd);
    if (tagStart < 0) break;

    const next = xml.charCodeAt(tagStart + 1);
    if (next === 0x21 /* ! */) {
      if (xml.startsWith('<![CDATA[', tagStart)) {
        const end = indexOrEnd(xml, ']]>', tagStart + 9);
        // Escaped like the text around it, so decoding gives it back as it was.
        stack[stack.length - 1]!.text += xml.slice(tagStart + 9, end).replaceAll('&', '&amp;');
        position = end + 3;
      } else if (xml.startsWith('<!--', tagStart)) {
        position = indexOrEnd(xml, '-->', tagStart + 4) + 3;
      } else {
        position = indexOrEnd(xml, '>', tagStart) + 1;
      }
    } else if (next === 0x3f /* ? */) {
      position = indexOrEnd(xml, '?>', tagStart) + 2;
    } else if (next === 0x2f /* / */) {
      const end = indexOrEnd(xml, '>', tagStart);
      position = end + 1;
      if (stack.length > 1) close(stack.pop()!, stack[stack.length - 1]!, arrays);
    } else {
      NAME_END.lastIndex = tagStart + 1;
      const nameEnd = NAME_END.exec(xml)?.index ?? xml.length;
      const name = xml.slice(tagStart + 1, nameEnd);
      const end = tagEnd(xml, nameEnd);
      position = end + 1;
      const element: OpenElement = { name, node: null, text: '' };
      if (xml.charCodeAt(end - 1) === 0x2f /* / */) close(element, stack[stack.length - 1]!, arrays);
      else stack.push(element);
    }
  }

  while (stack.length > 1) close(stack.pop()!, stack[stack.length - 1]!, arrays);
  return root.node!;
}

function close(element: OpenElement, parent: OpenElement, arrays: ReadonlySet<string>): void {
  const text = decode(element.text.trim());
  let value: unknown = text;
  if (element.node) {
    if (text) element.node['#text'] = text;
    value = element.node;
  }
  parent.node ??= {};
  const siblings = parent.node;
  const existing = siblings[element.name];
  if (arrays.has(element.name)) {
    if (existing) (existing as unknown[]).push(value);
    else siblings[element.name] = [value];
  } else if (existing === undefined) {
    siblings[element.name] = value;
  } else if (Array.isArray(existing)) {
    // A single element's value is never an array: this one holds its repeated siblings.
    existing.push(value);
  } else {
    siblings[element.name] = [existing, value];
  }
}

/** Where a start tag ends: its `>`, skipping any inside quoted attribute values. */
function tagEnd(xml: string, from: number): number {
  let quote = 0;
  for (let index = from; index < xml.length; index++) {
    const code = xml.charCodeAt(index);
    if (quote) {
      if (code === quote) quote = 0;
    } else if (code === 0x22 || code === 0x27) {
      quote = code;
    } else if (code === 0x3e) {
      return index;
    }
  }
  return xml.length;
}

function indexOrEnd(xml: string, search: string, from: number): number {
  const index = xml.indexOf(search, from);
  return index < 0 ? xml.length : index;
}

/** Line breaks read as `\n`, as XML says; then the entities. */
function decode(text: string): string {
  const lines = text.includes('\r') ? text.replace(/\r\n?/g, '\n') : text;
  return lines.includes('&') ? lines.replace(ENTITY, (_match, name: string) => ENTITIES[name]!) : lines;
}
