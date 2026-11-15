import { describe, expect, it } from 'vitest';
import { err, ok } from './result';
import {
  addSeconds,
  elapsed,
  instant,
  intervalSeconds,
  later,
  remaining,
  reps,
  roll,
  seconds,
  watchInterval,
  type Instant,
  type Seconds,
  type WatchInterval,
} from './values';

const s = (n: number) => n as Seconds;
const t = (n: number) => n as Instant;

describe('watchInterval', () => {
  it.each([
    [1, err('InvalidWatchInterval')],
    [2, ok(2)],
    [20, ok(20)],
    [30, ok(30)],
    [31, err('InvalidWatchInterval')],
    [2.5, err('InvalidWatchInterval')],
    [Number.NaN, err('InvalidWatchInterval')],
  ])('watchInterval(%s) is %j', (input, expected) => {
    expect(watchInterval(input)).toEqual(expected);
  });
});

describe('reps', () => {
  it.each([
    [0, err('InvalidReps')],
    [1, ok(1)],
    [20, ok(20)],
    [1.5, err('InvalidReps')],
    [-3, err('InvalidReps')],
  ])('reps(%s) is %j', (input, expected) => {
    expect(reps(input)).toEqual(expected);
  });
});

describe('seconds and instant', () => {
  it('accept non-negative finite numbers', () => {
    expect(seconds(0)).toEqual(ok(0));
    expect(seconds(1.5)).toEqual(ok(1.5));
    expect(instant(1_700_000_000_000)).toEqual(ok(1_700_000_000_000));
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('reject %s', (input) => {
    expect(seconds(input)).toEqual(err('InvalidSeconds'));
    expect(instant(input)).toEqual(err('InvalidInstant'));
  });
});

describe('roll', () => {
  it.each([
    [0, ok(0)],
    [0.5, ok(0.5)],
    [0.999999, ok(0.999999)],
    [1, err('InvalidRoll')],
    [-0.1, err('InvalidRoll')],
    [Number.NaN, err('InvalidRoll')],
  ])('roll(%s) is %j', (input, expected) => {
    expect(roll(input)).toEqual(expected);
  });
});

describe('arithmetic', () => {
  it('adds seconds', () => {
    expect(addSeconds(s(1), s(2.5))).toBe(3.5);
  });

  it('computes the time remaining, never negative', () => {
    expect(remaining(s(30), s(120))).toBe(90);
    expect(remaining(s(200), s(120))).toBe(0);
  });

  it('converts a watch interval to seconds', () => {
    expect(intervalSeconds(20 as WatchInterval)).toBe(1200);
  });

  it('measures elapsed seconds and treats a backwards clock as zero', () => {
    expect(elapsed(t(1_000), t(11_000))).toBe(10);
    expect(elapsed(t(11_000), t(1_000))).toBe(0);
  });

  it('adds seconds to an instant', () => {
    expect(later(t(1_000), s(10))).toBe(11_000);
  });
});
