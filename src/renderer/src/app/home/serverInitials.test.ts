import { describe, expect, it } from 'vitest';
import { serverInitials } from './serverInitials';

describe('serverInitials', () => {
  it('takes the first letters of the first two words', () => {
    expect(serverInitials('pixel-forge')).toBe('PF');
    expect(serverInitials('Acme_Global_Game_Jam')).toBe('AG');
    expect(serverInitials('danipen_unity')).toBe('DU');
  });

  it('takes the first two letters of a one-word name', () => {
    expect(serverInitials('acme')).toBe('AC');
    expect(serverInitials('x')).toBe('X');
  });

  it('goes by the host of a server address', () => {
    expect(serverInitials('ssl://plasticscm.hq.colossalorder.fi:8088')).toBe('PL');
    expect(serverInitials('localhost:8084')).toBe('LO');
  });
});
