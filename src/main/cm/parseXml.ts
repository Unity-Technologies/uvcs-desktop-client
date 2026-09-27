import { readXmlTree, type XmlNode } from './xmlTree';

export type { XmlNode };

/**
 * Parses `cm` XML output. Values stay as strings (comments like "123" must not become numbers)
 * and the given element names always come back as arrays, even with a single child.
 */
export function parseXml(xml: string, arrayElements: string[]): XmlNode {
  return readXmlTree(xml.slice(xml.indexOf('<')), new Set(arrayElements));
}

export function text(node: unknown): string {
  return typeof node === 'string' ? node : '';
}

/** A date, or `''` where `cm` reports the minimum one (`0001-01-01…`): added items not checked in yet, moved ones. */
export function dateText(node: unknown): string {
  const date = text(node);
  return date.startsWith('0001-') ? '' : date;
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
