import { describe, expect, it } from 'vitest';
import { readXmlTree } from './xmlTree';

const read = (xml: string, arrays: string[] = []) => readXmlTree(xml, new Set(arrays));

describe('readXmlTree', () => {
  it('reads elements with children as objects and the rest as their trimmed text', () => {
    expect(read('<?xml version="1.0" encoding="utf-8"?><R><A>  a b  </A><B /><C></C><D><E>1</E></D><F>  </F></R>')).toEqual({
      R: { A: 'a b', B: '', C: '', D: { E: '1' }, F: '' },
    });
  });

  it('always makes arrays of the given elements, and of any element repeated under one parent', () => {
    expect(read('<R><L>1</L><N><L /></N><M>1</M><M>2</M><M><X>3</X></M></R>', ['L'])).toEqual({
      R: { L: ['1'], N: { L: [''] }, M: ['1', '2', { X: '3' }] },
    });
  });

  it('decodes the named entities once, and leaves character references as they are', () => {
    expect(read('<R><A>&lt;&amp;lt;&gt;&quot;&apos; &#xD;&#10;</A></R>')).toEqual({ R: { A: `<&lt;>"' &#xD;&#10;` } });
  });

  it('reads every line break as a line feed', () => {
    expect(read('<R><A>a\r\nb\rc\nd</A></R>')).toEqual({ R: { A: 'a\nb\nc\nd' } });
  });

  it('skips attributes (with > in their values), comments, doctypes and processing instructions', () => {
    const xml = `<!DOCTYPE R><R version="1 > 0" other='x/'><!-- <A>no</A> --><A x="y">a</A><?pi x?><B x="/>" /></R>`;
    expect(read(xml)).toEqual({ R: { A: 'a', B: '' } });
  });

  it('keeps CDATA as it is written', () => {
    expect(read('<R><A><![CDATA[<b> &amp; </b>]]></A></R>')).toEqual({ R: { A: '<b> &amp; </b>' } });
  });

  it('keeps text beside children as #text', () => {
    expect(read('<R>t<F>f</F>u</R>')).toEqual({ R: { F: 'f', '#text': 'tu' } });
  });

  it('closes what an output cut short left open', () => {
    expect(read('<R><A>1</A><B>2')).toEqual({ R: { A: '1', B: '2' } });
  });

  it('reads huge outputs in linear time', () => {
    const change = '<Change><Type>CH</Type><Path>src/a &amp; b.ts</Path><OldPath /><Size>3</Size></Change>\n';
    const xml = `<StatusOutput><Changes>${change.repeat(200_000)}</Changes></StatusOutput>`;
    const start = performance.now();
    const tree = read(xml, ['Change']);
    // About 0.15 s here; the XML library it replaced took 1.3 s.
    expect(performance.now() - start).toBeLessThan(2000);
    expect(((tree.StatusOutput as Record<string, Record<string, unknown[]>>).Changes!.Change)).toHaveLength(200_000);
  });
});
