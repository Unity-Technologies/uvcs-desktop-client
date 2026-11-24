import { describe, expect, it } from 'vitest';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import { commentedModelSpotOf, locationNumber, MAX_LOCATION_LENGTH, modelLocation, modelLocationOption } from './modelCommentLocation';

describe('commentedModelSpotOf', () => {
  it('reads the point alone, in the file’s own space', () => {
    expect(commentedModelSpotOf('model:0.1,1.5,-2')).toEqual({ point: { x: 0.1, y: 1.5, z: -2 } });
    expect(commentedModelSpotOf('model:0,0,0')).toEqual({ point: { x: 0, y: 0, z: 0 } });
  });

  it('reads every hint: the part, the point in its space, the whole part, the camera', () => {
    expect(commentedModelSpotOf('model:12.5,40,-3;node=Car/Wheel_FL;local=0.5,0,-1;part;view=0,0.6,0.8,250')).toEqual({
      point: { x: 12.5, y: 40, z: -3 },
      node: { path: ['Car', 'Wheel_FL'], local: { x: 0.5, y: 0, z: -1 } },
      wholePart: true,
      view: { direction: { x: 0, y: 0.6, z: 0.8 }, distance: 250 },
    });
  });

  it('reads the hints in any order, and past those it doesn’t know', () => {
    expect(commentedModelSpotOf('model:1,2,3;view=1,0,0,5;future=x%3By;part;local=1,1,1;node=Body')).toEqual({
      point: { x: 1, y: 2, z: 3 },
      node: { path: ['Body'], local: { x: 1, y: 1, z: 1 } },
      wholePart: true,
      view: { direction: { x: 1, y: 0, z: 0 }, distance: 5 },
    });
  });

  it('reads past a line end a Windows cm prints', () => {
    expect(commentedModelSpotOf('model:1,2,3;node=Body\r')).toEqual({ point: { x: 1, y: 2, z: 3 }, node: { path: ['Body'] } });
  });

  it('decodes the names: a slash, a semicolon, an equals sign, spaces and quotes inside one, Japanese and emoji', () => {
    const location = 'model:1,2,3;node=Root%2FA/Wheel%3B%20FL%3D1/%27Bolt%27/%E8%BB%8A%E8%BC%AA/%F0%9F%9A%97';
    expect(commentedModelSpotOf(location)?.node?.path).toEqual(['Root/A', 'Wheel; FL=1', "'Bolt'", '車輪', '🚗']);
  });

  it('reads no spot in lines, an image, or a point it would misplace', () => {
    expect(commentedModelSpotOf('11')).toBeNull();
    expect(commentedModelSpotOf('lines:2-5')).toBeNull();
    expect(commentedModelSpotOf('image:120,80')).toBeNull();
    expect(commentedModelSpotOf('model:1,2')).toBeNull();
    expect(commentedModelSpotOf('model:1,2,3,4')).toBeNull();
    expect(commentedModelSpotOf('model:1e3,2,3')).toBeNull();
    expect(commentedModelSpotOf('model:NaN,2,3')).toBeNull();
    expect(commentedModelSpotOf('model:1,,3')).toBeNull();
    expect(commentedModelSpotOf('model:1;2;3')).toBeNull();
    expect(commentedModelSpotOf('model:')).toBeNull();
  });

  it('drops a hint it can’t read and keeps the point', () => {
    expect(commentedModelSpotOf('model:1,2,3;local=1,2;view=0,0,0,5;node=')).toEqual({ point: { x: 1, y: 2, z: 3 } });
    expect(commentedModelSpotOf('model:1,2,3;view=0,1,0,-5')).toEqual({ point: { x: 1, y: 2, z: 3 } });
    expect(commentedModelSpotOf('model:1,2,3;node=Bad%E0%A4%A')).toEqual({ point: { x: 1, y: 2, z: 3 } });
  });

  it('reads the point in a part’s space, and the whole part, only with the part they’re about', () => {
    expect(commentedModelSpotOf('model:1,2,3;local=1,1,1;part')).toEqual({ point: { x: 1, y: 2, z: 3 } });
  });
});

describe('modelLocation', () => {
  const spot: ModelSpot = {
    point: { x: 12.5, y: 40, z: -3 },
    node: { path: ['Car', 'Wheel_FL'], local: { x: 0.5, y: 0, z: -1 } },
    wholePart: true,
    view: { direction: { x: 0, y: 0.6, z: 0.8 }, distance: 250 },
  };

  it('writes the point, then its hints in order', () => {
    expect(modelLocation(spot)).toBe('model:12.5,40,-3;node=Car/Wheel_FL;local=0.5,0,-1;part;view=0,0.6,0.8,250');
    expect(modelLocation({ point: { x: 1, y: 2, z: 3 } })).toBe('model:1,2,3');
    expect(modelLocationOption({ point: { x: 1, y: 2, z: 3 } })).toBe('--location=model:1,2,3');
  });

  it('encodes the names as printable ASCII with no space or quote, which cm refuses and a cm shell line can’t carry', () => {
    const location = modelLocation({ point: { x: 0, y: 0, z: 0 }, node: { path: ['Root/A', 'Wheel; FL=1', "'Bolt' (2)!*", '車輪', '🚗'] } });
    expect(location).toBe('model:0,0,0;node=Root%2FA/Wheel%3B%20FL%3D1/%27Bolt%27%20%282%29%21%2A/%E8%BB%8A%E8%BC%AA/%F0%9F%9A%97');
    expect(location).toMatch(/^[\x21-\x7e]+$/);
    expect(location).not.toMatch(/["']/);
  });

  it('writes what it reads back', () => {
    expect(commentedModelSpotOf(modelLocation(spot))).toEqual(spot);
    const named = { point: { x: -0.000125, y: 1234.5678, z: 3 }, node: { path: ['Root/A', '車輪', '🚗', "it's"] } };
    expect(commentedModelSpotOf(modelLocation(named))).toEqual(named);
  });

  it('keeps the point whole however deep the part, dropping the camera, then the point in the part, then the part to fit', () => {
    // 40 levels of 23-character names, the last longer by `extra`: 1,017 characters with every hint.
    const deep = (extra: number) => Array.from({ length: 40 }, (_, level) => `${String(level).padStart(2, '0')}_${'Joint'.repeat(4)}` + (level === 39 ? 'x'.repeat(extra) : ''));
    const spotAt = (extra: number): ModelSpot => ({ ...spot, node: { path: deep(extra), local: { x: 1, y: 2, z: 3 } } });
    expect(modelLocation(spotAt(0))).toHaveLength(1017);
    expect(commentedModelSpotOf(modelLocation(spotAt(0)))).toEqual(spotAt(0));

    const withoutView = modelLocation(spotAt(8));
    expect(withoutView.length).toBeLessThanOrEqual(MAX_LOCATION_LENGTH);
    expect(commentedModelSpotOf(withoutView)).toEqual({ point: spot.point, node: { path: deep(8), local: { x: 1, y: 2, z: 3 } }, wholePart: true });

    const withoutLocal = modelLocation(spotAt(27));
    expect(withoutLocal.length).toBeLessThanOrEqual(MAX_LOCATION_LENGTH);
    expect(commentedModelSpotOf(withoutLocal)).toEqual({ point: spot.point, node: { path: deep(27) }, wholePart: true });

    const pointOnly = modelLocation({ ...spot, node: { path: Array.from({ length: 40 }, (_, level) => `${level}_${'車輪'.repeat(4)}`) } });
    expect(commentedModelSpotOf(pointOnly)).toEqual({ point: spot.point });
  });
});

describe('locationNumber', () => {
  it('keeps eight significant digits: a millimetre across ten kilometres', () => {
    expect(locationNumber(10000.0004)).toBe('10000');
    expect(locationNumber(9999.0014)).toBe('9999.0014');
    expect(locationNumber(0.123456789)).toBe('0.12345679');
    expect(locationNumber(-2.5)).toBe('-2.5');
  });

  it('never writes an exponent, however small or large', () => {
    expect(locationNumber(1e-7)).toBe('0.0000001');
    expect(locationNumber(1e-12)).toBe('0');
    expect(locationNumber(-1e-12)).toBe('0');
    expect(locationNumber(1.5e21)).toBe('1500000000000000000000');
    expect(locationNumber(123456789012)).toBe('123456789012');
  });
});
