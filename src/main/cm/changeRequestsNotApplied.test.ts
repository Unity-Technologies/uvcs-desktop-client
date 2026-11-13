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

  it("reads them as a cm shell gives them: it joins a line starting with two spaces to the one before", () => {
    const output = 'STAGE \nError: The following review change requests (specified in the checkin comment) cannot be found or are already applied in a previous changeset:- 9cc0d065';
    expect(changeRequestsNotApplied(output, 'Again [apply-change:9cc0d065]')).toEqual(['9cc0d065']);
    expect(changeRequestsNotApplied('Error: …changeset:- deadbeef- cafebabe', '[apply-change:deadbeef] [apply-change:cafebabe]')).toEqual(['deadbeef', 'cafebabe']);
  });

  it("reads them on Windows, where the joined line keeps its line's carriage return", () => {
    expect(changeRequestsNotApplied('Error: …changeset:\r- deadbeef\r- cafebabe', '[apply-change:deadbeef] [apply-change:cafebabe]')).toEqual(['deadbeef', 'cafebabe']);
  });

  // cm's message in each language it speaks, the list where the message puts it: some go on after it.
  it.each([
    ['English', 'Error: The following review change requests (specified in the checkin comment) cannot be found or are already applied in a previous changeset:\n  - deadbeef'],
    ['Japanese', 'Error: チェックインコメントで指定された次のレビューの変更要求は見つからないか、前の変更セット:\n  - deadbeef ですでに適用されています'],
    ['Korean', 'Error: 체크인 코멘트에 지정된 다음 리뷰 변경 요청을 찾을 수 없거나 이전 변경 세트:\n  - deadbeef에 이미 적용되었습니다.'],
    ['Simplified Chinese', 'Error: 找不到签入注释中指定的以下评审更改请求，或已在之前的变更集中应用：\n  - deadbeef'],
  ])('reads them in %s, the list wherever the message puts it', (_language, output) => {
    expect(changeRequestsNotApplied(output, 'Fix [apply-change:deadbeef]')).toEqual(['deadbeef']);
    expect(changeRequestsNotApplied(output.replace('\n  ', ''), 'Fix [apply-change:deadbeef]')).toEqual(['deadbeef']);
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
    // A longer hex word is no request number, though it starts like one.
    expect(changeRequestsNotApplied('Error: …:\n  - deadbeef0', 'Fix [apply-change:deadbeef]')).toBeNull();
  });
});
