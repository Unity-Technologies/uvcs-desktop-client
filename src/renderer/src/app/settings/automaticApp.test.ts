import { describe, expect, it } from 'vitest';
import { automaticAppDescription, AUTOMATIC_EDITOR_RULE } from './automaticApp';

describe('automaticAppDescription', () => {
  it('names the app Automatic uses, or says the rule while none is found', () => {
    expect(automaticAppDescription('Visual Studio Code', AUTOMATIC_EDITOR_RULE)).toBe('Uses Visual Studio Code');
    expect(automaticAppDescription(undefined, AUTOMATIC_EDITOR_RULE)).toBe('The first editor found');
  });
});
