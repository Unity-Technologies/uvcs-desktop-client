import { describe, expect, it } from 'vitest';
import { SILENT_FAILURE_MESSAGE } from './CmError';
import { extractErrorMessage, USAGE_MESSAGE } from './errorMessage';

// Outputs captured from failing `cm` 11.0.16 commands.
describe('extractErrorMessage', () => {
  it('takes the only line of a one-line failure', () => {
    expect(extractErrorMessage('br:/main/nope does not exist.\n')).toBe('br:/main/nope does not exist.');
  });

  it('skips the progress line and drops the "Error:" prefix', () => {
    const output =
      'The selected items are about to be checked in. Please wait ...\n\nError: There are no changes in the workspace /private/tmp/wk\n';
    expect(extractErrorMessage(output)).toBe('There are no changes in the workspace /private/tmp/wk');
  });

  it('keeps the explanation after progress lines', () => {
    const output = [
      'The selected items are about to be checked in. Please wait ...',
      'Validating checkin data',
      '',
      "A merge is needed from changeset 'cs:2' to changeset 'cs:1' in order to checkin. The checkin operation cannot continue.",
    ].join('\n');
    expect(extractErrorMessage(output)).toBe(
      "A merge is needed from changeset 'cs:2' to changeset 'cs:1' in order to checkin. The checkin operation cannot continue.",
    );
  });

  it('drops the code, stages and trailing fields of a machine-readable checkin failure', () => {
    const output = [
      'CI_START',
      'STAGE Validating checkin data',
      'STAGE ',
      "MERGE_NEEDED A merge is needed from changeset 'cs:2@rep:wk@repserver:local(mount:/)' to changeset 'cs:1@rep:wk@repserver:local(mount:/)' in order to checkin. The checkin operation cannot continue. 2 1 errtest-rep local /",
    ].join('\n');
    expect(extractErrorMessage(output)).toBe(
      "A merge is needed from changeset 'cs:2@rep:wk@repserver:local(mount:/)' to changeset 'cs:1@rep:wk@repserver:local(mount:/)' in order to checkin. The checkin operation cannot continue.",
    );
  });

  it('picks the complaint above the usage help instead of its last option', () => {
    const output = [
      'status: Unexpected option --bogusflag',
      'Shows changes in the workspace.',
      '',
      'Usage:',
      '',
      '    cm status [<wk_path>] [--changelist[=<name>] | --changelists] [--cutignored]',
      '',
      'Options:',
      '    --all                          This flag replaces the following parameters:',
      "                                    '--localdeleted', '--localmoved', '--private'.",
      '',
    ].join('\n');
    expect(extractErrorMessage(output)).toBe('Unexpected option --bogusflag');
  });

  it('says the arguments were rejected when only the usage help was printed', () => {
    const output =
      'Creates a new workspace.\n\nUsage:\n\n    cm workspace | wk [create | mk] <rep_spec>\n\nOptions:\n\n    wk_name             The new workspace name.\n';
    expect(extractErrorMessage(output)).toBe(USAGE_MESSAGE);
  });

  it('prefers the error line over the progress and stack frames that follow it', () => {
    const output = [
      'Unity VCS is updating your workspace. Wait a moment, please...',
      'Error: Object reference not set to an instance of an object.',
      '   at Codice.Client.Commands.UpdateCommand.Run(String[] args)',
      '   at Codice.Client.Commands.CommandRunner.Execute()',
    ].join('\n');
    expect(extractErrorMessage(output)).toBe('Object reference not set to an instance of an object.');
  });

  it('ignores machine-readable stage lines', () => {
    const output =
      '<STAGE:Calculating conflicts>\nThe update operation detected conflicts. The operation cannot continue since it was run with the --dontmerge option.\n<STAGE:Finished>\n';
    expect(extractErrorMessage(output)).toBe(
      'The update operation detected conflicts. The operation cannot continue since it was run with the --dontmerge option.',
    );
  });

  it('keeps the configuration error of an unconfigured client whole', () => {
    const output =
      "Error: Unity VCS client is not correctly configured for the current user: Client config file /Users/me/.plastic4/client.conf not found. Please execute 'cm configure' to perform a text mode configuration.\n";
    expect(extractErrorMessage(output)).toMatch(/^Unity VCS client is not correctly configured/);
  });

  it('falls back to a generic message when nothing was printed', () => {
    expect(extractErrorMessage('\n')).toBe(SILENT_FAILURE_MESSAGE);
  });
});
