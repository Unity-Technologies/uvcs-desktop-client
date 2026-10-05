import { describe, expect, it } from 'vitest';
import { isBinaryFbx, readFbxProperty } from './fbxProperties';

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A binary FBX's header, then a "P" record's values as its writer lays them out. */
function binaryFbx(...values: (string | { int: number } | { double: number })[]): Uint8Array {
  const parts: number[] = [...ascii('Kaydara FBX Binary  '), 0, 0x1a, 0, 0xe8, 0x1c, 0, 0, ...ascii('P')];
  for (const value of values) {
    if (typeof value === 'string') {
      const text = ascii(value);
      parts.push(0x53, ...uint32(text.length), ...text);
    } else if ('int' in value) {
      parts.push(0x49, ...new Uint8Array(new Int32Array([value.int]).buffer));
    } else {
      parts.push(0x44, ...new Uint8Array(new Float64Array([value.double]).buffer));
    }
  }
  return new Uint8Array(parts);
}

const uint32 = (value: number): number[] => [...new Uint8Array(new Uint32Array([value]).buffer)];

describe('readFbxProperty', () => {
  it('reads global settings from ASCII FBX', () => {
    const file = ascii(['; FBX 7.4.0 project file', 'GlobalSettings:  {', '\tProperties70:  {', '\t\tP: "UpAxis", "int", "Integer", "",2', '\t\tP: "UnitScaleFactor", "double", "Number", "",100', '\t}', '}'].join('\r\n'));
    expect(isBinaryFbx(file)).toBe(false);
    expect(readFbxProperty(file, 'UpAxis')).toBe(2);
    expect(readFbxProperty(file, 'UnitScaleFactor')).toBe(100);
  });

  it('reads the app that exported an ASCII FBX', () => {
    const file = ascii('P: "Original|ApplicationName", "KString", "", "", "Blender (stable FBX IO)"\nP: "Original|ApplicationVersion", "KString", "", "", "4.2.1"\n');
    expect(readFbxProperty(file, 'Original|ApplicationName')).toBe('Blender (stable FBX IO)');
    expect(readFbxProperty(file, 'Original|ApplicationVersion')).toBe('4.2.1');
  });

  it('reads ints, doubles and strings from binary FBX', () => {
    expect(isBinaryFbx(binaryFbx())).toBe(true);
    expect(readFbxProperty(binaryFbx('UpAxis', 'int', 'Integer', '', { int: 1 }), 'UpAxis')).toBe(1);
    expect(readFbxProperty(binaryFbx('UnitScaleFactor', 'double', 'Number', '', { double: 2.54 }), 'UnitScaleFactor')).toBe(2.54);
    expect(readFbxProperty(binaryFbx('Original|ApplicationName', 'KString', '', '', 'Maya'), 'Original|ApplicationName')).toBe('Maya');
  });

  it('skips the name where it is no property record, as in a longer name or a comment', () => {
    const file = binaryFbx('UpAxisSign', 'int', 'Integer', '', { int: -1 }, 'UpAxis', 'int', 'Integer', '', { int: 2 });
    expect(readFbxProperty(file, 'UpAxis')).toBe(2);
  });

  it('is undefined when the file never sets it', () => {
    expect(readFbxProperty(ascii('; FBX 7.4.0 project file\n'), 'UpAxis')).toBeUndefined();
    expect(readFbxProperty(binaryFbx('UpAxis', 'int'), 'UpAxis')).toBeUndefined();
  });
});
