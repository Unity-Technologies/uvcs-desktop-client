import { describe, expect, it } from 'vitest';
import { connectionProblemWords } from './connectionProblemWords';

describe('connectionProblemWords', () => {
  it("names the server out of reach, and what to look at", () => {
    expect(connectionProblemWords({ server: 'codice@cloud', commandLine: 'cm checkconnection codice@cloud', output: '' })).toEqual({
      title: "Can't reach codice@cloud",
      explanation: 'Check your network or VPN connection and that the server is running, then retry.',
    });
  });
});
