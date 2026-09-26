import { describe, expect, it } from 'vitest';
import { syntaxLanguage } from './syntaxLanguage';

describe('syntaxLanguage', () => {
  it('highlights SVG as XML and Unity assets as YAML', () => {
    expect(syntaxLanguage('Assets/icon.svg')).toBe('xml');
    expect(syntaxLanguage('Assets/Scripts/Player.cs.meta')).toBe('yaml');
    expect(syntaxLanguage('Assets/Scenes/Main.unity')).toBe('yaml');
    expect(syntaxLanguage('Assets/Hero.prefab')).toBe('yaml');
  });

  it('leaves everything else to Pierre', () => {
    expect(syntaxLanguage('src/app.ts')).toBe('typescript');
    expect(syntaxLanguage('build.xml')).toBe('xml');
  });
});
