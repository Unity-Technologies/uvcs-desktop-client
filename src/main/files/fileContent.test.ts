import { describe, expect, it } from 'vitest';
import { EMPTY_CONTENT, MAX_IMAGE_BYTES, MAX_MODEL_BYTES, MAX_TEXT_BYTES, toFileContent } from './fileContent';

describe('toFileContent', () => {
  it('reads text as UTF-8', () => {
    expect(toFileContent(Buffer.from('hello\n'), 'a.txt')).toEqual({ isBinary: false, size: 6, text: 'hello\n' });
  });

  it('treats a 0-byte file as empty, even with an image extension', () => {
    expect(toFileContent(Buffer.alloc(0), 'icon.png')).toBe(EMPTY_CONTENT);
  });

  it('recognizes binary content by a NUL byte', () => {
    expect(toFileContent(Buffer.from([1, 0, 2]), 'a.bin')).toEqual({ isBinary: true, size: 3 });
  });

  it('flags text over the cap as too large rather than binary', () => {
    const size = MAX_TEXT_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size, 'a'), 'big.log')).toEqual({ isBinary: true, size, tooLarge: 'text' });
  });

  it('keeps the bytes of images, recognized by extension', () => {
    const content = toFileContent(Buffer.from([137, 80, 78, 71]), 'Textures/Hero.PNG');
    expect(content.image?.mimeType).toBe('image/png');
    expect([...content.image!.bytes]).toEqual([137, 80, 78, 71]);
    expect(Buffer.isBuffer(content.image!.bytes)).toBe(false);
  });

  it('keeps the bytes of the textures the renderer decodes itself, of their own type', () => {
    const types = ['a.TGA', 'b.tif', 'c.tiff', 'd.exr', 'e.hdr', 'f.psd', 'g.PSB'].map((name) => toFileContent(Buffer.from([0, 1, 2]), name).image?.mimeType);
    expect(types).toEqual(['image/x-tga', 'image/tiff', 'image/tiff', 'image/x-exr', 'image/vnd.radiance', 'image/vnd.adobe.photoshop', 'image/vnd.adobe.photoshop']);
    expect(toFileContent(Buffer.from([0, 1, 2]), 'a.tga')).toMatchObject({ isBinary: true, size: 3 });
  });

  it('keeps nothing of a texture over the image cap', () => {
    const size = MAX_IMAGE_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size), 'Albedo.psd')).toEqual({ isBinary: true, size, tooLarge: 'image' });
  });

  it('does not encode images over the cap', () => {
    const size = MAX_IMAGE_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size), 'huge.png')).toEqual({ isBinary: true, size, tooLarge: 'image' });
  });

  it('reads an SVG both as text and as an image', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    expect(toFileContent(Buffer.from(svg), 'Icons/logo.SVG')).toEqual({
      isBinary: false,
      size: svg.length,
      text: svg,
      image: { bytes: new Uint8Array(Buffer.from(svg)), mimeType: 'image/svg+xml' },
    });
  });

  it('keeps only the image of an SVG too large to diff as text, and nothing of one over the image cap', () => {
    const large = toFileContent(Buffer.alloc(MAX_TEXT_BYTES + 1, 'a'), 'map.svg');
    expect(large).toMatchObject({ isBinary: true, size: MAX_TEXT_BYTES + 1 });
    expect(large.text).toBeUndefined();
    expect(large.image?.mimeType).toBe('image/svg+xml');
    expect(large.image?.bytes.length).toBe(MAX_TEXT_BYTES + 1);
    const size = MAX_IMAGE_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size, 'a'), 'huge.svg')).toEqual({ isBinary: true, size, tooLarge: 'image' });
  });

  it('keeps the bytes of a binary FBX as a model only', () => {
    const fbx = Buffer.concat([Buffer.from('Kaydara FBX Binary  '), Buffer.from([0, 0x1a, 0])]);
    const content = toFileContent(fbx, 'Assets/Characters/Hero.FBX');
    expect(content).toEqual({ isBinary: true, size: fbx.length, model: { bytes: new Uint8Array(fbx), format: 'fbx' } });
    expect(Buffer.isBuffer(content.model!.bytes)).toBe(false);
  });

  it('reads the text formats of models both as text and as a model', () => {
    const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
    expect(toFileContent(Buffer.from(obj), 'Props/crate.obj')).toEqual({
      isBinary: false,
      size: obj.length,
      text: obj,
      model: { bytes: new Uint8Array(Buffer.from(obj)), format: 'obj' },
    });
    expect(toFileContent(Buffer.from('; FBX 7.4.0 project file'), 'rock.fbx').text).toBe('; FBX 7.4.0 project file');
    expect(toFileContent(Buffer.from('{"asset":{"version":"2.0"}}'), 'tree.gltf').model?.format).toBe('gltf');
  });

  it('keeps a GLB as a model only', () => {
    const glb = Buffer.from([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
    expect(toFileContent(glb, 'tree.glb')).toEqual({ isBinary: true, size: glb.length, model: { bytes: new Uint8Array(glb), format: 'glb' } });
  });

  it('keeps only the model of a text model too large to diff, and nothing of one over the model cap', () => {
    const large = toFileContent(Buffer.alloc(MAX_TEXT_BYTES + 1, 'v'), 'city.obj');
    expect(large.text).toBeUndefined();
    expect(large).toMatchObject({ isBinary: true, size: MAX_TEXT_BYTES + 1, model: { format: 'obj' } });
    const size = MAX_MODEL_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size, 'v'), 'huge.fbx')).toEqual({ isBinary: true, size, tooLarge: 'model' });
  });
});
