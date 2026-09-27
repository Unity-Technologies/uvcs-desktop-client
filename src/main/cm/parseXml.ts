import { XMLParser } from 'fast-xml-parser';

export type XmlNode = Record<string, unknown>;

/**
 * Parses `cm` XML output. Values stay as strings (comments like "123" must not become numbers)
 * and the given element names always come back as arrays, even with a single child.
 */
export function parseXml(xml: string, arrayElements: string[]): XmlNode {
  const arrays = new Set(arrayElements);
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => arrays.has(name),
  });
  return parser.parse(xml.slice(xml.indexOf('<'))) as XmlNode;
}

export function text(node: unknown): string {
  return typeof node === 'string' ? node : '';
}

export function integer(node: unknown, fallback = -1): number {
  const parsed = Number.parseInt(text(node), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function children(parent: unknown, name: string): XmlNode[] {
  if (!parent || typeof parent !== 'object') return [];
  const value = (parent as XmlNode)[name];
  return Array.isArray(value) ? (value as XmlNode[]) : [];
}

export function child(parent: unknown, name: string): XmlNode | undefined {
  if (!parent || typeof parent !== 'object') return undefined;
  const value = (parent as XmlNode)[name];
  return value && typeof value === 'object' ? (value as XmlNode) : undefined;
}
