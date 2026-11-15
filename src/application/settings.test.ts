import { describe, expect, it } from 'vitest';
import { defaultPolicy } from '../domain/break-policy';
import type { WatchInterval } from '../domain/values';
import { parseSettings, toStoredSettings } from './settings';

describe('parseSettings', () => {
  it('reads a valid watch interval', () => {
    expect(parseSettings({ watchIntervalMinutes: 5 })).toEqual({
      ...defaultPolicy,
      watchInterval: 5,
    });
  });

  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'twenty'],
    ['an object without the key', { other: 1 }],
    ['a non-number', { watchIntervalMinutes: '5' }],
    ['too short an interval', { watchIntervalMinutes: 1 }],
    ['too long an interval', { watchIntervalMinutes: 31 }],
    ['a fractional interval', { watchIntervalMinutes: 2.5 }],
  ])('falls back to the default for %s', (_, raw) => {
    expect(parseSettings(raw)).toBe(defaultPolicy);
  });

  it('round-trips through the stored shape', () => {
    expect(parseSettings(toStoredSettings(12 as WatchInterval)).watchInterval).toBe(12);
  });
});
