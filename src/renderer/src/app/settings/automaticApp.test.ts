import { describe, expect, it } from 'vitest';
import type { ExternalApp } from '@shared/domain/externalApps';
import { automaticAppDescription, AUTOMATIC_EDITOR_RULE, isAutomatic } from './automaticApp';

const vscode: ExternalApp = { id: 'vscode', name: 'Visual Studio Code', origin: 'known', location: '/Applications/Visual Studio Code.app', opensFolders: true };

describe('automaticAppDescription', () => {
  it('names the app Automatic uses, or says the rule while none is found', () => {
    expect(automaticAppDescription('Visual Studio Code', AUTOMATIC_EDITOR_RULE)).toBe('Uses Visual Studio Code');
    expect(automaticAppDescription(undefined, AUTOMATIC_EDITOR_RULE)).toBe('The first editor found');
  });
});

describe('isAutomatic', () => {
  it('shows Automatic chosen when it is, or when the app chosen is no longer found', () => {
    expect(isAutomatic('auto', [vscode])).toBe(true);
    expect(isAutomatic('vscode', [vscode])).toBe(false);
    expect(isAutomatic('rider', [vscode])).toBe(true);
  });
});
