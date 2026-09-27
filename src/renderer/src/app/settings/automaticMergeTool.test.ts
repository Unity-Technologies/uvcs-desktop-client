import { describe, expect, it } from 'vitest';
import { AUTOMATIC_MERGE_TOOL_RULE, automaticMergeToolDescription } from './automaticMergeTool';

describe('automaticMergeToolDescription', () => {
  it('names the tool Automatic picks now, without restating the rule', () => {
    expect(automaticMergeToolDescription('UVCS merge tool')).toBe('Uses UVCS merge tool');
  });

  it('states the rule while no tool is found', () => {
    expect(automaticMergeToolDescription(undefined)).toBe(AUTOMATIC_MERGE_TOOL_RULE);
  });
});
