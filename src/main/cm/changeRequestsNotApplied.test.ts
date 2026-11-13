import { describe, expect, it } from 'vitest';
import { changeRequestsNotApplied } from './changeRequestsNotApplied';

/** What `cm checkin --machinereadable` prints when the changeset went in but a change request it names isn't pending. */
const CHECKIN_OUTPUT = [
  'CI_START',
  'STAGE Validating checkin data',
  'STAGE Uploading file data',
  'STAGE Confirming checkin operation',
  'STAGE ',
  'Error: The following review change requests (specified in the checkin comment) cannot be found or are already applied in a previous changeset:',
  '  - deadbeef',
  '  - cafebabe',
].join('\n');

describe('changeRequestsNotApplied', () => {
  it('reads the change requests cm found no pending one for, after it made the changeset', () => {
    expect(changeRequestsNotApplied(CHECKIN_OUTPUT, 'Again [apply-change:deadbeef] and [apply-change:cafebabe]')).toEqual(['deadbeef', 'cafebabe']);
  });

  it('reads them in any language, by the requests the comment names, listed after the error', () => {
    const output = ['Error: Les demandes de modification suivantes sont introuvables :', '  - deadbeef'].join('\r\n');
    expect(changeRequestsNotApplied(output, 'Fix [apply-change:deadbeef]')).toEqual(['deadbeef']);
  });

  it("reads a whole guid as the comment wrote it, as cm lists it", () => {
    const guid = '8123d65a-620d-49ee-bf51-f526741a3341';
    expect(changeRequestsNotApplied(`Error: …:\n  - ${guid}`, `Fix [apply-change:${guid.toUpperCase()}]`)).toEqual([guid]);
  });

  it('reads a short number written in capitals, which cm finds in the comment but never matches', () => {
    expect(changeRequestsNotApplied('Error: …:\n  - DEADBEEF', 'Fix [apply-change:DEADBEEF]')).toEqual(['deadbeef']);
  });

  it("reads none from any other failure: a list that isn't of the comment's requests, or no list", () => {
    expect(changeRequestsNotApplied('Error: The following items are locked:\n  - deadbeef', 'Fix it')).toBeNull();
    expect(changeRequestsNotApplied('Error: A merge is needed from changeset cs:4', 'Fix [apply-change:deadbeef]')).toBeNull();
    expect(changeRequestsNotApplied('Error: …:\n  - deadbeef\n  - /src/a.cs', 'Fix [apply-change:deadbeef]')).toBeNull();
  });
});
