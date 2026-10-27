import { describe, expect, it } from 'vitest';
import { text } from './parseXml';
import { XmlElementReader } from './XmlElementReader';

const HISTORY = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<RevisionHistoriesResult>',
  '  <RevisionHistories>',
  '    <RevisionHistory>',
  '      <ItemName>/Assets/Ñandú.cs</ItemName>',
  '      <Revisions>',
  '        <Revision><RevisionSpec>a#cs:3</RevisionSpec><Comment>Fix &lt;Revision&gt; &amp; more</Comment><ChangesetNumber>3</ChangesetNumber></Revision>',
  '        <Revision><RevisionSpec>a#cs:7</RevisionSpec><Comment>Señal</Comment><ChangesetNumber>7</ChangesetNumber></Revision>',
  '      </Revisions>',
  '    </RevisionHistory>',
  '  </RevisionHistories>',
  '</RevisionHistoriesResult>',
  '',
].join('\r\n');

const revisions = () => new XmlElementReader('Revision', (revision) => ({ changeset: text(revision.ChangesetNumber), comment: text(revision.Comment) }));
const READ = [
  { changeset: '3', comment: 'Fix <Revision> & more' },
  { changeset: '7', comment: 'Señal' },
];

describe('XmlElementReader', () => {
  it('reads each element of the list, leaving the root and the list tags out', () => {
    const reader = revisions();
    reader.read(Buffer.from(HISTORY, 'utf8'));
    expect(reader.finish()).toEqual(READ);
    expect(reader.takeRest()).toBe('\n      </Revisions>\n    </RevisionHistory>\n  </RevisionHistories>\n</RevisionHistoriesResult>\n');
  });

  it('reads the same however the output is cut, a tag or a character split between chunks', () => {
    const bytes = Buffer.from(HISTORY, 'utf8');
    for (const size of [1, 2, 3, 7, 64]) {
      const reader = revisions();
      for (let start = 0; start < bytes.length; start += size) reader.read(bytes.subarray(start, start + size));
      expect(reader.finish()).toEqual(READ);
    }
  });

  it('reads each element as soon as it closes', () => {
    const reader = revisions();
    const firstEnd = HISTORY.indexOf('</Revision>') + '</Revision>'.length;
    reader.read(Buffer.from(HISTORY.slice(0, firstEnd), 'utf8'));
    expect(reader.count).toBe(1);
  });

  it('leaves out an element its caller builds nothing of', () => {
    const reader = new XmlElementReader('Revision', (revision) => (text(revision.ChangesetNumber) === '3' ? undefined : text(revision.ChangesetNumber)));
    reader.read(Buffer.from(HISTORY, 'utf8'));
    expect(reader.finish()).toEqual(['7']);
  });

  it('gives an output with no element, an error, as the rest', () => {
    const reader = revisions();
    reader.read(Buffer.from("Error: The item 'a.cs' does not exist.\r\n", 'utf8'));
    expect(reader.finish()).toEqual([]);
    expect(reader.takeRest()).toBe("Error: The item 'a.cs' does not exist.\n");
  });

  it('carries no more than the element still arriving, however long the list', () => {
    const reader = revisions();
    const element = '<Revision><ChangesetNumber>1</ChangesetNumber></Revision>';
    for (let i = 0; i < 1000; i++) reader.read(Buffer.from(element, 'utf8'));
    reader.read(Buffer.from('<Revision><Changeset', 'utf8'));
    expect(reader.count).toBe(1000);
    expect(reader.takeRest()).toBe('<Revision><Changeset');
  });
});
