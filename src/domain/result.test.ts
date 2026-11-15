import { describe, expect, it } from 'vitest';
import { err, flatMap, getOrElse, map, ok, type Result } from './result';

const half = (n: number): Result<number, 'odd'> => (n % 2 === 0 ? ok(n / 2) : err('odd'));

describe('Result', () => {
  it('map transforms an ok value and passes an error through', () => {
    expect(map(ok(2), (n) => n + 1)).toEqual(ok(3));
    expect(map(err('boom'), (n: number) => n + 1)).toEqual(err('boom'));
  });

  it('flatMap chains results and stops at the first error', () => {
    expect(flatMap(ok(8), half)).toEqual(ok(4));
    expect(flatMap(ok(3), half)).toEqual(err('odd'));
    expect(flatMap(err('earlier' as const), half)).toEqual(err('earlier'));
  });

  it('getOrElse unwraps an ok value or falls back', () => {
    expect(getOrElse(ok(1), 0)).toBe(1);
    expect(getOrElse(err('x'), 0)).toBe(0);
  });
});
