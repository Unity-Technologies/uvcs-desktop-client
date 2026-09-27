import { describe, expect, it } from 'vitest';
import { serverInitials } from './serverInitials';

describe('serverInitials', () => {
  it('takes the first letters of the first two words', () => {
    expect(serverInitials('snakes-org')).toBe('SO');
    expect(serverInitials('UC_Global_Hack_a_thon')).toBe('UG');
    expect(serverInitials('danipen_unity')).toBe('DU');
  });

  it('takes the first two letters of a one-word name', () => {
    expect(serverInitials('codice')).toBe('CO');
    expect(serverInitials('x')).toBe('X');
  });

  it('goes by the host of a server address', () => {
    expect(serverInitials('ssl://plasticscm.hq.colossalorder.fi:8088')).toBe('PL');
    expect(serverInitials('localhost:8084')).toBe('LO');
  });
});
